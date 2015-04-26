CREATE TABLE "MESSAGES"

(

"ID" INT not null primary key
        GENERATED ALWAYS AS IDENTITY
        (START WITH 1, INCREMENT BY 1),   
"USER_ID" INT,     
"MESSAGE" VARCHAR(50),
"ROOM_ID" INT,
"CREATED_TIME" TIME NOT NULL
);