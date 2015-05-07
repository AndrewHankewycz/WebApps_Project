var request = require('request'),
  User = require('./user'),
  config = require('./config'),
  util = require('../util/util'),
  io = require('socket.io')(config.port),
  xss = require('xss'),
  CommandProcessor = require('./commands/command_processor'),
  RoomHelper = require('./util/room_helper.js'),
  UserHelper = require('./util/user_helper.js');

global.rooms = [];
global.users = [];
global.usersOnline = 0;

RoomHelper.insertRoomsFromDB();

io.on('connection', function(socket) {
  socket.on('disconnect', function () {
    UserHelper.removeBySocketId(socket.id);
  });

  socket.on('message', function(data) {
    if(data === null)
      return;

    var message = xss(data.message);

    if(CommandProcessor.process(io, socket, message))
      return;

    var user = UserHelper.getUserFromRoom(socket.id);

    request.post(config.DAO_URL, {
        form: {
          action: 'message',
          message: message,
          userId: user.getUserId(),
          roomId: data.roomId
        }
      },
      function (error, response, body) {
          if (!error && response.statusCode == 200 && body != "-1") {
            var messageId = parseInt(body);

            if(messageId === -1)
              return;

            RoomHelper.streamEventToRoom('message', {
              messageId: messageId,
              roomId: data.roomId,
              userId: user.getUserId(),
              username: user.getUsername(),
              message: message
            }, data.roomId);
          }
        });
  });

  socket.on('edit_message', function(data) {
    if(data === null)
      return;

    var messageId = parseInt(data.messageId);
    var message = xss(data.message);

    var user = UserHelper.getUserFromRoom(socket.id);

    //TODO: Log to database
    RoomHelper.streamEventToRoom('message_edited', {
      messageId: messageId,
      username: user.getUsername(),
      roomId: data.roomId,
      message: message
    }, data.roomId);
  });

  socket.on('login', function(data, cb) {
    if(data === null)
      return;

    var username = data.username;

    if(config.DEBUG) {
      //TODO: Reuse the code below
      var user = new User(++global.usersOnline, username, socket);
      var roomData = RoomHelper.addUserToRoom(data.roomId.toLowerCase(), user);

      if(roomData === null) {
        console.log("Could not login!");
        cb({
          error: "Error on login!",
          room: null
        });
      } else {
        console.log("Logged in!");
        cb({
          error: null,
          room: roomData
        });
      }
      return;
    }

    request.post(config.NAVIGATOR_URL, {
        form: {
          action: 'login',
          username: username,
          password: data.password
        }
      },
      function (error, response, body) {
          if (!error && response.statusCode == 200 && body != "-1") {
              var userResp = JSON.parse(body);

              if(userResp.userId === -1) {
                cb({
                  error: "Incorrect username/password",
                  room: null,
                  userId: user.getUserId()
                });
                return;
              }

              var user = new User(userResp.userId, username, socket);
              var roomData = RoomHelper.addUserToRoom(data.roomId.toLowerCase(), user);

              if(roomData === null) {
                console.log("Could not login!");
                cb({
                  error: "Error on login!",
                  room: null
                });
              } else {
                console.log("Logged in!");
                cb({
                  error: null,
                  room: roomData,
                  userId: user.getUserId()
                });
              }
          }
      });
  });
});