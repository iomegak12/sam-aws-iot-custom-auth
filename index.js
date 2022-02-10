#!/user/bin/env node

require('dotenv').config();

const AWS = require('aws-sdk');
const IOT = require('aws-iot-device-sdk');

const {
    TEST_USER_USERNAME,
    TEST_USER_PASSWORD,
    COGNITO_CLIENT_ID,
    COGNITO_USER_POOL_ID,
    IOT_ENDPOINT,
    AWS_REGION
} = process.env;

const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
    apiVersion: '2016-04-18'
});

const getLoginTokens = async () => {
    const response = await cognitoIdentityServiceProvider.adminInitiateAuth({
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: {
            USERNAME: TEST_USER_USERNAME,
            PASSWORD: TEST_USER_PASSWORD
        },
        ClientId: COGNITO_CLIENT_ID,
        UserPoolId: COGNITO_USER_POOL_ID
    }).promise();

    if (!response.AuthenticationResult) {
        console.log(response);

        throw new Error("Could not be able to Login");
    }

    return response.AuthenticationResult;
};

const script = async () => {
    const eventTopic = `/event/${TEST_USER_USERNAME}`;
    const { IdToken } = await getLoginTokens();
    const device = IOT.device({
        host: IOT_ENDPOINT,
        region: AWS_REGION,
        protocol: 'wss-custom-auth',
        customAuthHeaders: {
            'X-Amz-CustomAuthorizer-Name': 'CognitoAuthorizer',
            CognitoToken: IdToken
        }
    });

    device.on('connect', () => {
        console.log('AWS IoT Endpoint Connected Successfully!');

        device.subscribe(eventTopic);
        device.publish(eventTopic, 'Hello from Toshiba IoT Device!');
        device.on('close', () => console.log('Disconnected!'));
    });

    device.on('message', (topic, payload) => {
        console.log('Incoming Message from IoT Hub ...', topic,
            Buffer.from(payload).toString('utf-8'));
    });

    device.on('error', console.error);
};

script()
    .catch(console.error);