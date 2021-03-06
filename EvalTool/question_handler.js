      var questionsLen = 10;
      var userId = -1;
      var question = null;

      function nextLetter(s){
        return s.replace(/([a-zA-Z])[^a-zA-Z]*$/, function(a){
            var c= a.charCodeAt(0);
            switch(c){
                case 90: return 'A';
                case 122: return 'a';
                default: return String.fromCharCode(++c);
            }
        });
      }

      function updateButtonStates(){
        if((question.questionId < 1)) {
          $("#prevButton", window.parent.document).prop('disabled', true);
          return;
        }

        if(question.questionId > 0) {
          $("#prevButton", window.parent.document).prop('disabled', false);
        }

        if(question.questionId === questionsLen-1) {
          $("#nextButton", window.parent.document).prop('value', 'Submission');
        }

        if(question.questionId === questionsLen-2) {
          $("#nextButton", window.parent.document).prop('value', 'Next');
        }
      }

      function doLoad() {
        $("#answers").hide();
        var currentLetter = 'a';

        $("#radioAnswers").empty();
        $("#questionId").text("Question " + (question.questionId + 1) + "/" + questionsLen);
        $("#question").text(question.question);

        for(var i = 0; i < question.answers.length; i++) {
          $("#radioAnswers").append("<p><label><input id='answer"+i+"' type='radio' name='radio' value='"+i+"'> (" + currentLetter+ ") " + question.answers[i] + "</label></p>");
          currentLetter = nextLetter(currentLetter);
        }

        if(parseInt(question.userAnswerId) != -1)
          $("#answer" + question.userAnswerId).attr('checked', true);

        $("#answers").fadeIn(500);
      }

      function loadQuestion() {
        if( $('#radioAnswers').is(':empty') ) {
          doLoad();
        } else {
          $("#answers").fadeOut(500).promise().done(function() {
            doLoad();
          });
        }
      }

      function login() {
        $.ajax({
          url: "/EvalTool/login",
          dataType: "jsonp",
          success: function(result) {
            userId = result.userId;
            question = result.question;

            loadQuestion();
          },
          error: function() {
            //TODO: Handle this error
          }
        });
      }

      $(document).ready(function() {
        //Get the userId
        login();

        $("#nextButton", window.parent.document).prop('disabled', false);
        $("#startButton", window.parent.document).prop('disabled', true);
        $("#cancelButton", window.parent.document).prop('disabled', false);

        function submitButtonClick(next, successCallback, answer) {
          return function() {

            if(question.questionId + 1 > questionsLen-1 && next) {
              var answer = parseInt($('input[name=radio]:checked', '#answers').val());
              $("#content").empty();

              $.ajax({
                url: "/EvalTool/page11.html",
                dataType: "html"
              }).done(function( responseHtml ) {
                $.ajax({
                  url: "/EvalTool/submit",
                  dataType: "jsonp",
                  data: {
                    userId: userId,
                    questionId: question.questionId,
                    answer: answer
                  },
                  success: function(result) {
                    $("#content").html(responseHtml);
                    var finalScoreText = "Your final score: " + result.correctAnswers + "/" + questionsLen;

                    $("#finalScore").text(finalScoreText);
                    $('input[name=message]').val(finalScoreText);

                    $("#nextButton", window.parent.document).prop('disabled', true);
                    $("#startButton", window.parent.document).prop('disabled', true);
                    $("#cancelButton", window.parent.document).prop('disabled', true);
                    $("#prevButton", window.parent.document).prop('disabled', true);
                    $("#emailButton", window.parent.document).prop('disabled', false);
                  },
                  error: function() {
                    //TODO: Handle this error
                  }
                });
              });
              return;
            }

            var answer = parseInt($('input[name=radio]:checked', '#answers').val());

            $.ajax({
              url: "/EvalTool/testing",
              dataType: "jsonp",
              data: {
                userId: userId,
                questionId: question.questionId,
                answer: answer,
                //Next button = 1, prev button = -1
                direction: next ? 1 : -1
              },
              success: function(result) {
                question = result.question;
                successCallback(result);
                updateButtonStates();
              },
              error: function() {
                //TODO: Handle this error
              }
            });
          }
        }

        $("#cancelButton", window.parent.document).click(function(result) {
          $.ajax({
            url:"/EvalTool/startpage.html",
            type: "GET",
            success: function(response){
              $("#content").html(response);
            },
            error: function(){
              console.log("error resetting quiz");
            }
          });
        });

        $("#nextButton", window.parent.document).click(submitButtonClick(true, function(result) {
            loadQuestion();
        }));

        $("#prevButton", window.parent.document).click(submitButtonClick(false, function(result) {
            loadQuestion();
        }));

        $("#emailButton", window.parent.document).click(function() {
          $.ajax({
            url:"/EvalTool/sendmail",
            type: "POST",
            data: {
              fname: $("#fname").val(),
              femail: $("#femail").val(),
              tname: $("#tname").val(),
              temail: $("#temail").val(),
              subject: $("#subject").val(),
              message: $("#message").val()
            },
            success: function(response){
              $("#content").html(response);
              $("#emailButton", window.parent.document).prop('disabled', true);
            },
            error: function(){
              console.log("error resetting quiz");
            }
          });
        });
      });
