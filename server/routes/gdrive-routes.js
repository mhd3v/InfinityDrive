const { google } = require('googleapis');
const _ = require('lodash');
const { ObjectID } = require('mongodb');
const { User } = require('../models/user');

var { authenticate } = require('../middleware/authenticate');

var oAuth2Client_google;

var express = require('express'),
    router = express.Router();

const gdriveHelper = require('../utils/gdrive-helper');

var currentToken = '';

router
    .use((req, res, next) => {   //this runs before each route

        // res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');    
        // res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');    
        // res.setHeader('Access-Control-Allow-Headers', 'x-auth,content-type');      
        // res.setHeader('Access-Control-Allow-Credentials', true);  

        var client_id = '651431583012-j0k0oent5gsprkdimeup45c44353pb35.apps.googleusercontent.com';
        var client_secret = '9aRhiRYg7Va5e5l6Dq-x5VFL';
        var redirect_uri = 'http://localhost:3000/gdrive/saveToken';

        oAuth2Client_google = new google.auth.OAuth2(client_id, client_secret, redirect_uri);

        //this code runs when we request to google w/ a token that is expired or is going to expire soon
        // google takes our refresh token and sends us back a new access token so we update the current token w/ it
        oAuth2Client_google.on('tokens', async (tokens) => {

            console.log('Recieved refreshed token');

            if (tokens.refresh_token) {
                console.log(tokens.refresh_token);
            }

            await User.findOneAndUpdate({
                'accounts': {
                    '$elemMatch': {
                        'token.access_token': currentToken
                    }
                }
            },
                {
                    '$set': {
                        "accounts.$.token.access_token": tokens.access_token,
                        "accounts.$.token.id_token": tokens.id_token,
                        "accounts.$.token.expiry_date": tokens.expiry_date
                    }
                });

        });

        next();
    })

    .get('/authorize', (req, res) => {
        gdriveHelper.getAuthorizationUrl(req, res, oAuth2Client_google);
    })

    .get('/saveToken', authenticate, (req, res) => {
        gdriveHelper.saveToken(req, res, oAuth2Client_google, req.user);
    })

    .get('/listFiles/:accountId', authenticate, async (req, res) => {

        var accountId = req.params.accountId;
        if (!ObjectID.isValid(accountId))
            return res.status(404).send('Account ID not valid!');

        try {
            var token = await req.user.getTokensForAccounts([accountId]);
            var files = await gdriveHelper.getFilesForAccount(oAuth2Client_google, token);
            res.send(files);
        } catch (error) {
            return res.status(400).send(error);
        }

    })

    .get('/downloadUrl/:accountId/:fileId', authenticate, async (req, res) => {

        var accountId = req.params.accountId;
        if (!ObjectID.isValid(accountId))
            return res.status(404).send('Account ID not valid!');
        
        try {
            var token = await req.user.getTokensForAccounts([accountId]);
            currentToken = token.access_token;
            res.send(await gdriveHelper.getDownloadUrl(req.user, accountId, oAuth2Client_google, token, req.params.fileId));
        } catch (error) {
            return res.status(400).send(error);
        }

    });


module.exports = router;
