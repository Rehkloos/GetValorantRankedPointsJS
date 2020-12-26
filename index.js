const axios = require('axios').default;
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const moment = require('moment');
moment.locale('pt-br');

require('dotenv').config()

axiosCookieJarSupport(axios);

const cookieJar = new tough.CookieJar();

const username = process.env.USER;
const pwd = process.env.PASSWORD;

const auth = () => {

  return new Promise((resolve, reject) => {

    let data = {
      'client_id': 'play-valorant-web-prod',
      'nonce': '1',
      'redirect_uri': 'https://beta.playvalorant.com/opt_in',
      'response_type': 'token id_token',
    };

    axios.post('https://auth.riotgames.com/api/v1/authorization', data, {
        jar: cookieJar,
        withCredentials: true
      })
      .then(response => {

        //create an .env file at the root of the project and add these variables
        data = {
          'type': 'auth',
          'username': username,
          'password': pwd
        };

        axios.put('https://auth.riotgames.com/api/v1/authorization', data, {
            jar: cookieJar,
            withCredentials: true
          })
          .then(response => {

            let uri = response.data.response.parameters.uri;
            let strTokens = uri.replace('https://beta.playvalorant.com/opt_in#', '').split('&');

            let arrayTokens = {};

            strTokens.forEach(token => {
              arrayTokens[token.split('=')[0]] = token.split('=')[1];
            });

            //console.log('Access Token:', arrayTokens.access_token)


            axios.defaults.headers.common['Authorization'] = `Bearer ${arrayTokens.access_token}`

            axios.post('https://entitlements.auth.riotgames.com/api/token/v1', {}, {
                jar: cookieJar,
                withCredentials: true
              })
              .then(response => {

                let entitlements_token = response.data.entitlements_token;
                axios.defaults.headers.common['X-Riot-Entitlements-JWT'] = entitlements_token

                //console.log('\nEntitlements Token:', entitlements_token);

                axios.post('https://auth.riotgames.com/userinfo', {}, {
                    jar: cookieJar,
                    withCredentials: true
                  })
                  .then(response => {

                    let user_id = response.data.sub;
                    console.log('Player Id:', user_id);
                    resolve(user_id);

                  });

              });

          });

      })
      .catch(error => {
        reject(error);
      });

  });
}

const getMovementString = movement => {

  switch (movement) {

    case 'INCREASE':
      return 'Rating increased';
    case 'MAJOR_INCREASE':
      return 'Rating increased a lot';
    case 'MINOR_INCREASE':
      return 'Rating increased slightly';

    case 'DECREASE':
      return 'Rating fell';
    case 'MAJOR_DECREASE':
      return 'Rating dropped a lot';
    case 'MINOR_DECREASE':
      return 'Rating dropped a little';

    case 'PROMOTED':
      return 'Promotion';

    default:
      return 'Demotion';

  }

}

const getRankString = rankId => {

  let rankName, rankNumber;

  if (rankId < 6)
    rankName = 'Iron';
  else if (rankId < 9)
    rankName = 'Bronze';
  else if (rankId < 12)
    rankName = 'Prata';
  else if (rankId < 15)
    rankName = 'Gold';
  else if (rankId < 18)
    rankName = 'Platinum';
  else if (rankId < 21)
    rankName = 'Diamond';
  else if (rankId < 24)
    rankName = 'Immortal';
  else
    return 'Radiant';

  if (((rankId / 3) % 1).toFixed(2) == 0.00) {
    rankNumber = 1;
  } else if (((rankId / 3) % 1).toFixed(2) == 0.33) {
    rankNumber = 2;
  } else {
    rankNumber = 3;
  }

  return `${rankName} ${rankNumber}`

}

const getRankedInfo = async (startIndex = 0, endIndex = '') => {

  let playerId = await auth();
  let res = await axios.get(`https://pd.NA.a.pvp.net/mmr/v1/players/${playerId}/competitiveupdates?startIndex=${startIndex}&endIndex=${endIndex}`);

  let matches = res.data.Matches.reverse();
  matches = matches.filter(match => match.CompetitiveMovement != 'MOVEMENT_UNKNOWN'); //filtra as partidas rankeadas apenas;

  if (matches.length) {

    matches.forEach(match => {

      console.log('\nMatch found:', moment(match.MatchStartTime).format('DD/MM/YYYY HH:mm'));
      console.log('Points before:', match.TierProgressBeforeUpdate, '|| Points after:', match.TierProgressAfterUpdate);
      console.log('Rank before:', getRankString(match.TierBeforeUpdate), '|| Rank after:', getRankString(match.TierAfterUpdate));
      console.log('Movement:', getMovementString(match.CompetitiveMovement));

    });

  }

}

getRankedInfo();