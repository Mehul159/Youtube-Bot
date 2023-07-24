const express = require('express');
const { google } = require('googleapis');

// Put the following at the top of the file
// right below the'googleapis' import
const util = require('util');
const fs = require('fs');

let newMessages;
let liveChatId; // Where we'll store the id of our liveChat
let nextPage; // How we'll keep track of pagination for chat messages
const intervalTime = 5000; // Miliseconds between requests to check chat messages
let interval; // variable to store and control the interval that will check messages
let chatMessages = []; // where we'll store all messages

const writeFilePromise = util.promisify(fs.writeFile);
const readFilePromise = util.promisify(fs.readFile);

const save = async (path, data) => {
  await writeFilePromise(path, data);
  console.log('Successfully Saved');
};

const read = async path => {
  const fileContents = await readFilePromise(path);
  return JSON.parse(fileContents);
};

const youtube = google.youtube('v3');
const OAuth2 = google.auth.OAuth2;

// auth.setCredentials({ key: 'AIzaSyC_wkwueHzWXL20entouTEqMID98xDwgBM' });

const clientId = '1062181479933-avbop6p6sggms6l08i1knjmjda1bs03s.apps.googleusercontent.com';
const clientSecret = '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';
const redirectURI = 'http://localhost:3000/callback';
const apiKey = 'AIzaSyC_wkwueHzWXL20entouTEqMID98xDwgBM';

// Permissions needed to view and submit live chat comments
const scope = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl'
];

const auth = new OAuth2(clientId, clientSecret, redirectURI, apiKey);


const youtubeService = {};

youtubeService.getCode = response => {
  const authUrl = auth.generateAuthUrl({
    access_type: 'offline',
    scope
  });
  response.redirect(authUrl);
};

// Request access from tokens using code from login
youtubeService.getTokensWithCode = async code => {
  const credentials = await auth.getToken(code);
  youtubeService.authorize(credentials);
};

// Storing access tokens received from google in auth object
youtubeService.authorize = ({ tokens }) => {
  auth.setCredentials(tokens);
  console.log('Successfully set credentials');
  console.log('tokens:', tokens);
  save('./tokens.json', JSON.stringify(tokens));
};

//Update the tokens automatically when they expire

auth.on('tokens', tokens => {
  console.log('new Tokens recived :');
});

// Read tokens from stored file
const checkTokens = async () => {
  const tokens = await read('./tokens.json');
  if (tokens) {
    console.log('settings tokens');
    return auth.setCredentials(tokens);
  }
  console.log('no tokens set');

};



youtubeService.findActiveChat = async () => {
  const response = await youtube.liveBroadcasts.list({
    auth,
    part: 'snippet',
    mine: 'true'
  });
  const latestChat = response.data.items[0];

  if (latestChat && latestChat.snippet.liveChatId) {
    liveChatId = latestChat.snippet.liveChatId;
    console.log("Chat ID Found:", liveChatId);
  } else {
    console.log("No Active Chat Found");
  }
};

const respond = newMessages => {
  newMessages.forEach(message => {
    const messageText = message.snippet.displayMessage.toLowerCase();
    if (messageText.includes('thanks')) {
      const author = message.authorDetails.displayName;
      const response = `You're welcome ${author}!`;
      youtubeService.insertMessage(response);
    } else if (messageText.includes('hi')) {
      const author = message.authorDetails.displayName;
      const response = `${author}! Sup Buddy😎`;
      youtubeService.insertMessage(response);
    } else if (messageText.includes('!timeout')) {
      chatbanBot();
    }
  });
};





//responding messages
//********************************************************************************************************** */
// const respond = newMessages => {
//   newMessages.forEach(message => {
//     const messageText = message.snippet.displayMessage.toLowerCase();
//     if (messageText.includes('thanks')) {
//       const author = message.authorDetails.displayName;
//       const response = `You're welcome ${author}!`;
//       youtubeService.insertMessage(response);
//     }

//     else if (messageText.includes('!timeout')) {
//       console.log('1');
//       chatbanBot();
//       console.log('2');
//     }
//   });
// };
//************************************************************************************************************** */
//Extracting chats form chatbox

const getChatMessages = async () => {
  const response = await youtube.liveChatMessages.list({
    auth,
    part: 'snippet,authorDetails',
    liveChatId,
    pageToken: nextPage
  });
  const { data } = response;
  newMessages = data.items;
  chatMessages.push(...newMessages);
  nextPage = data.nextPageToken;
  console.log('Total Chat Messages:', chatMessages.length);
  respond(newMessages);
};

//tracking livechat synchronously

youtubeService.startTrackingChat = () => {
  interval = setInterval(getChatMessages, intervalTime);
};

youtubeService.stopTrackingChat = () => {
  clearInterval(interval);
};








//Inserting new messages from author & new
//********************************************************************************************************** */
youtubeService.insertMessage = messageText => {
  const userid = youtube.channels.list({ auth, part: ["id"], forUsername: "Awsii" });
  console.log(userid);
  youtube.liveChatMessages.insert(
    {
      auth,
      part: 'snippet',
      resource: {
        snippet: {
          type: 'textMessageEvent',
          liveChatId,
          textMessageDetails: {
            messageText
          }
        }
      }
    },
    () => { }
  );
};
//************************************************************************************************************ */

// youtube.liveChatMessages.insert(
//   {
//     auth,
//     part: 'snippet',
//     resource: {
//       snippet: {
//         type: 'textMessageEvent',
//         liveChatId,
//         textMessageDetails: {
//           //messageText
//         }
//       }
//     }
//   },
//   () => {}
// );




checkTokens();

// As we progress throug this turtorial, Keep the following line at the nery bottom of the file
// It will allow other files to access to our functions


module.exports = youtubeService;



// Set the live stream ID you want to monitor
const liveStreamId = 'b5gu-9uth-92v3-cm1g-1eah';

// Define the list of banned keywords
const bannedKeywords = ['bad', 'inappropriate', 'spam'];

// Function to check if a chat message violates moderation rules
function checkModerationRules(messageText) {
  console.log('checkmessages');
  console.log(messageText);
  for (const keyword of bannedKeywords) {
    if (messageText.toLowerCase().includes(keyword)) {
      console.log('true');
      return true;
    }
  }
  console.log('not banned');
  return false;

}

// Function to ban a user from chat
async function banUser(user) {
  const response = await youtube.liveChatBans.insert({
    auth,
    part: 'snippet',
    requestBody: {
      snippet: {
        liveChatId,
        type: 'temporary',
        banDurationSeconds: 300,  // Duration in seconds (5 minutes)
        bannedUserDetails: {
          channelId: user
        }
      }
    }
  });
  console.log('User banned:', user);
}

// Main function to listen for chat messages and apply moderation


const chatbanBot = async () => {
  //console.log(data);
  //console.log(response);
  // console.log(newMessages);
  // console.log('.....................................................................................');
  // console.log(liveChatId);
  // console.log('.....................................................................................');
  // console.log(nextPage);
  // console.log('.....................................................................................');
  // console.log('.....................................................................................');
  // const response = await youtube.liveChatMessages.list({
  //   auth,
  //   part: 'snippet,authorDetails',
  //   liveChatId,
  //   pageToken: nextPage
  // });
  // const { data } = response;
  // // nextPage = data.nextPageToken;
  // console.log('data :', data);
  // console.log('.....................................................................................');
  // //console.log(response);
  // console.log(auth);
  // console.log('.....................................................................................');
  // console.log(liveChatId);
  // console.log('.....................................................................................');
  // console.log(nextPage);
  // //console.log(pageToken);
  // // const response = await youtube.liveChatMessages.list({
  // //   part: 'snippet,authorDetails',
  // //   liveChatId: liveStreamId
  // // });

  // const messages = data.items;

  //console.log('messages:', messages);
  for (const message of newMessages) {
    const messageText = message.snippet.displayMessage;
    const userId = message.authorDetails.channelId;

    if (checkModerationRules(messageText)) {
      await banUser(userId);
    }
  }
}


// Function to handle moderator commands
function handleModeratorCommands(message) {
  const messageText = message.snippet.displayMessage.toLowerCase();
  const command = messageText.split(' ')[0].toLowerCase();

  if (!isModerator(message.authorDetails)) {
    console.log(`User ${message.authorDetails.channelId} is not authorized to execute moderator commands.`);
    return;
  }

  // Filter out URLs from the message
  const urls = extractURLs(messageText);
  const filteredURLs = filterURLs(urls);
  console.log('Filtered URLs:', filteredURLs);

  switch (command) {
    case '!mute':
      const userId = message.authorDetails.channelId;
      moderatorCommands.mute(userId);
      break;
    case '!ban':
       userId = message.authorDetails.channelId;
      moderatorCommands.ban(userId);
      break;
    case '!delete':
      const messageId = message.id;
      moderatorCommands.deleteMessage(messageId);
      break;
    default:
      console.log(`Unrecognized moderator command: ${command}`);
  }
}

// Function to extract URLs from a text string
function extractURLs(text) {
  const urlPattern = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
  return text.match(urlPattern);
}

// Function to filter URLs based on rules
function filterURLs(urls) {
  const filteredURLs = [];

  for (const url of urls) {
    if (isURLAllowed(url)) {
      filteredURLs.push(url);
    } else {
      console.log(`Filtered URL: ${url}`);
    }
  }

  return filteredURLs;
}



// // Run the chatban bot
// chatbanBot().catch(console.error);