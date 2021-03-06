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

    if(user === null) {
      return;
    }

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

  socket.on('delete_message', function(data) {
    if(data === null)
      return;

    var messageId = parseInt(data.messageId);
    var message = xss(data.message);

    var user = UserHelper.getUserFromRoom(socket.id);

    if(user === null) {
      return;
    }

    request.post(config.DAO_URL, {
        form: {
          action: 'deleteMessage',
          messageId: messageId,
          userId: user.getUserId()
        }
      },
      function (error, response, body) {
          if (!error && response.statusCode == 200 && body != "-1") {
            RoomHelper.streamEventToRoom('message_deleted', {
              messageId: messageId,
              roomId: data.roomId
            }, data.roomId);
          }
        });
  });

  socket.on('export_messages', function() {
    request.post(config.DAO_URL, {
        form: {
          action: 'export'
        }
      },
      function (error, response, body) {
          if (!error && response.statusCode == 200 && body != "-1") {
            console.log("Successfully exported!");
          }
      });
  });

  socket.on('edit_message', function(data) {
    if(data === null)
      return;

    var messageId = parseInt(data.messageId);
    var message = xss(data.message);

    var user = UserHelper.getUserFromRoom(socket.id);

    if(user === null) {
      return;
    }

    request.post(config.DAO_URL, {
        form: {
          action: 'editMessage',
          messageId: messageId,
          userId: user.getUserId(),
          message: message
        }
      },
      function (error, response, body) {
          if (!error && response.statusCode == 200 && body != "-1") {
            RoomHelper.streamEventToRoom('message_edited', {
              messageId: messageId,
              username: user.getUsername(),
              roomId: data.roomId,
              message: message
            }, data.roomId);
          }
      });
  });

  socket.on('register', function(data, cb) {
    if(data === null)
      return;

    var username = data.username;
    var password = data.password;

    request.post(config.NAVIGATOR_URL, {
        form: {
          action: 'register',
          username: username,
          password: password
        }
      },
      function (error, response, body) {
          if (!error && response.statusCode == 200 && body != "-1") {
              var userResp = JSON.parse(body);

              if(userResp.userId === -1) {
                var errorText = "Username already exists!";
                console.log(errorText);
                cb({
                  error: errorText
                });
                return;
              }

              console.log("Successfully registered!");
              cb({
                error: null
              });
          }
      });
  });

  socket.on('login', function(data, cb) {
    if(data === null)
      return;

    var username = data.username;

    if(config.DEBUG) {
      //TODO: Reuse the code below
      var user = new User(++global.usersOnline, username, socket);
      var roomData = RoomHelper.addUserToRoom(data.roomId.toLowerCase(), user);
      var allRoomTopics = RoomHelper.getRoomTopics();

      if(roomData === null) {
        console.log("Could not login!");
        cb({
          error: "Error on login!",
          room: null,
          rooms: []
        });
      } else {
        console.log("Logged in!");
        cb({
          error: null,
          room: roomData,
          rooms: allRoomTopics
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
                  error: "Incorrect username/password"
                });
                return;
              }

              var roomTopic = data.roomId.toLowerCase();

              request.post(config.DAO_URL, {
                  form: {
                    action: 'createRoom',
                    topic: roomTopic
                  }
                },
                function (error, response, body) {
                    if (!error && response.statusCode == 200 && body != "-1") {
                      var roomDbId = parseInt(body);

                      if(roomDbId === -1)
                        return;

                      RoomHelper.createRoom(roomDbId, roomTopic);
                    }

                    var user = new User(userResp.userId, username, socket);
                    var roomData = RoomHelper.addUserToRoom(roomTopic, user);
                    var allRoomTopics = RoomHelper.getRoomTopics();

                    if(roomData === null) {
                      console.log("Could not login!");
                      cb({
                        error: "Error on login!",
                        room: null,
                        rooms: []
                      });
                    } else {
                      console.log("Logged in!");
                      cb({
                        error: null,
                        room: roomData,
                        userId: user.getUserId(),
                        rooms: allRoomTopics
                      });
                    }
                  });
          }
      });
  });
});
