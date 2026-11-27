PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

INSERT OR REPLACE INTO app_meta (key, value)
   VALUES ('nextId', 121);

INSERT OR REPLACE INTO users
    (id, email, pass_hash, fails, lock_until, token_version, data_json)
    VALUES (
      1,
      'ayesha@demo.test',
      '$2a$10$oYGavcIci8cSg7YJVGkhbuKA7tmybNC/yGBeznlHgyQCLUPuN4a82',
      0,
      0,
      0,
      '{"id":1,"name":"Ayesha","age":22,"city":"Faisalabad","min":120,"max":250,"sleep":3,"clean":3,"guests":3,"noise":3,"smoke":0,"pets":0,"nosmoke":0,"nopets":0,"role":"seeker","type":"room","beds":1,"furn":1,"bio":"","w":{"sleep":3,"clean":3,"guests":3,"noise":3},"email":"ayesha@demo.test","fails":0,"lockUntil":0,"saved":[],"blocked":[],"movein":"","stay":"6","done":1,"wfh":0,"veg":0,"profession":"","area":"fsd-madina-town","anchor":"fsd-uaf","photo":"/photos/ee9c3c4cb1ba4fc73116.jpg","tv":0,"verified":1}'
    );

INSERT OR REPLACE INTO users
    (id, email, pass_hash, fails, lock_until, token_version, data_json)
    VALUES (
      2,
      'hamza@demo.test',
      '$2a$10$FCv/r7CTGiLmINw5FAsWjO4rC2SbNp6zhY.1FEGhY1jbqDkGA0p7a',
      0,
      0,
      0,
      '{"id":2,"name":"Hamza","age":25,"city":"Faisalabad","min":150,"max":300,"sleep":5,"clean":2,"guests":4,"noise":4,"smoke":1,"pets":0,"nosmoke":0,"nopets":0,"role":"host","type":"flat","beds":2,"furn":1,"bio":"Remote developer, late-night gamer, occasional smoker on the balcony.","w":{"sleep":3,"clean":3,"guests":2,"noise":2},"email":"hamza@demo.test","fails":0,"lockUntil":0,"saved":[],"blocked":[],"movein":"","stay":"6","done":1,"profession":"Software developer","area":"fsd-d-ground","anchor":"","photo":"","tv":0,"verified":1}'
    );

INSERT OR REPLACE INTO users
    (id, email, pass_hash, fails, lock_until, token_version, data_json)
    VALUES (
      3,
      'sara@demo.test',
      '$2a$10$kzT.E89oiQFySra7WnuHWe2d8t.1Rrfob2nFIi2Dv45J1OxLTyPX.',
      0,
      0,
      0,
      '{"id":3,"name":"Sara","age":24,"city":"Lahore","min":200,"max":350,"sleep":3,"clean":4,"guests":3,"noise":3,"smoke":0,"pets":1,"nosmoke":1,"nopets":0,"role":"host","type":"room","beds":1,"furn":0,"bio":"Freelance designer with a cat. Friendly, tidy, enjoys hosting friends.","w":{"sleep":3,"clean":3,"guests":2,"noise":2},"email":"sara@demo.test","fails":0,"lockUntil":0,"saved":[],"blocked":[],"movein":"","stay":"6","done":1,"profession":"Designer","area":"lhr-gulberg","anchor":"","photo":"","tv":0,"verified":1}'
    );

INSERT OR REPLACE INTO users
    (id, email, pass_hash, fails, lock_until, token_version, data_json)
    VALUES (
      4,
      'daniel@demo.test',
      '$2a$10$rQ4RV7usGk5lhhfyhlD7B.rg/p41vvbESFW5vdXgrw1VHTRmpdzwS',
      0,
      0,
      0,
      '{"id":4,"name":"Daniel","age":28,"city":"London","min":700,"max":1000,"sleep":4,"clean":3,"guests":3,"noise":3,"smoke":0,"pets":0,"nosmoke":0,"nopets":0,"role":"seeker","type":"flat","beds":2,"furn":1,"bio":"Works late shifts in a restaurant, loves food and football.","w":{"sleep":3,"clean":3,"guests":2,"noise":2},"email":"daniel@demo.test","fails":0,"lockUntil":0,"saved":[],"blocked":[],"movein":"","stay":"6","done":1,"profession":"Hospitality","area":"lon-camden","anchor":"lon-canary-wharf","photo":"","tv":0,"verified":1}'
    );

INSERT OR REPLACE INTO users
    (id, email, pass_hash, fails, lock_until, token_version, data_json)
    VALUES (
      5,
      'noor@demo.test',
      '$2a$10$gt9HlXHqKt.RYuYXl6dg.uL7D3dzlRxbeqiKOEgIQ8I0sojU0dgPu',
      0,
      0,
      0,
      '{"id":5,"name":"Noor","age":21,"city":"Faisalabad","min":100,"max":220,"sleep":1,"clean":4,"guests":1,"noise":1,"smoke":0,"pets":0,"nosmoke":1,"nopets":1,"role":"seeker","type":"room","beds":1,"furn":0,"bio":"Medical student, up at 5 am for the gym, needs a silent study space.","w":{"sleep":3,"clean":3,"guests":2,"noise":2},"email":"noor@demo.test","fails":0,"lockUntil":0,"saved":[],"blocked":[],"movein":"","stay":"6","done":1,"profession":"Medical student","area":"fsd-peoples-colony","anchor":"fsd-gcuf","photo":"","tv":0,"verified":1}'
    );

INSERT OR REPLACE INTO users
    (id, email, pass_hash, fails, lock_until, token_version, data_json)
    VALUES (
      6,
      'bilal@demo.test',
      '$2a$10$jOtU.zRNpdkPhdpXKwdYFOKCbJng97LTk489KjIxC7YLvNekh/fxq',
      0,
      0,
      0,
      '{"id":6,"name":"Bilal","age":26,"city":"Lahore","min":180,"max":320,"sleep":4,"clean":3,"guests":5,"noise":5,"smoke":0,"pets":0,"nosmoke":0,"nopets":0,"role":"host","type":"house","beds":3,"furn":1,"bio":"Sociable, loves game nights and cooking for guests. Works from home most days.","w":{"sleep":3,"clean":3,"guests":2,"noise":2},"email":"bilal@demo.test","fails":0,"lockUntil":0,"saved":[],"blocked":[],"movein":"","stay":"6","done":1,"profession":"Marketing","area":"lhr-johar-town","anchor":"","photo":"","tv":0,"verified":1}'
    );

INSERT OR REPLACE INTO users
    (id, email, pass_hash, fails, lock_until, token_version, data_json)
    VALUES (
      7,
      'emma@demo.test',
      '$2a$10$StuzHzSph058SjTx7Zf9GeAoh2tig4TIsMXAKnwEMeHrpFqXj124C',
      0,
      0,
      0,
      '{"id":7,"name":"Emma","age":27,"city":"Toronto","min":800,"max":1100,"sleep":2,"clean":5,"guests":2,"noise":2,"smoke":0,"pets":1,"nosmoke":1,"nopets":0,"role":"host","type":"studio","beds":1,"furn":1,"bio":"Yoga teacher and dog lover. Morning person, very organised.","w":{"sleep":3,"clean":3,"guests":2,"noise":2},"email":"emma@demo.test","fails":0,"lockUntil":0,"saved":[],"blocked":[],"movein":"","stay":"6","done":1,"profession":"Teacher","area":"tor-kensington","anchor":"","photo":"","tv":0,"verified":1}'
    );

INSERT OR REPLACE INTO users
    (id, email, pass_hash, fails, lock_until, token_version, data_json)
    VALUES (
      8,
      'zain@demo.test',
      '$2a$10$yL4KjMW2GsuB1gssl.jsuung2vgFyEXdCSI75YPiTDfm2v62uLfJu',
      0,
      0,
      0,
      '{"id":8,"name":"Zain","age":23,"city":"Faisalabad","min":130,"max":260,"sleep":5,"clean":1,"guests":3,"noise":4,"smoke":1,"pets":0,"nosmoke":0,"nopets":0,"role":"seeker","type":"flat","beds":2,"furn":0,"bio":"University student, vape smoker, studies late and sleeps in.","w":{"sleep":3,"clean":3,"guests":2,"noise":2},"email":"zain@demo.test","fails":0,"lockUntil":0,"saved":[],"blocked":[],"movein":"","stay":"6","done":1,"profession":"Student","area":"fsd-samanabad","anchor":"fsd-uaf","photo":"","tv":0,"verified":1}'
    );

INSERT OR REPLACE INTO requests
    (id, from_user, to_user, status, created_at, data_json)
    VALUES (
      100, 1, 5,
      'accepted', 1794052812751, '{"id":100,"from":1,"to":5,"status":"accepted","at":1794052812751,"resolveAt":1794052816751,"resolveTo":"accepted"}'
    );

INSERT OR REPLACE INTO requests
    (id, from_user, to_user, status, created_at, data_json)
    VALUES (
      113, 1, 7,
      'declined', 1794682807901, '{"id":113,"from":1,"to":7,"status":"declined","at":1794682807901,"resolveAt":1794682811901,"resolveTo":"declined"}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      101, 1, 5,
      'hello', 1794052826633, '{"id":101,"from":1,"to":5,"text":"hello","at":1794052826633}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      102, 5, 1,
      'Hi! Great to hear from you. When are you hoping to move in?', 1794052830248.0515, '{"id":102,"from":5,"to":1,"text":"Hi! Great to hear from you. When are you hoping to move in?","at":1794052830248.0515,"read":true}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      103, 1, 5,
      'I''m hoping to move in next month.', 1794682478780, '{"id":103,"from":1,"to":5,"text":"I''m hoping to move in next month.","at":1794682478780}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      104, 5, 1,
      'I''m hoping to move in next month.', 1794682481461.189, '{"id":104,"from":5,"to":1,"text":"I''m hoping to move in next month.","at":1794682481461.189,"read":true}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      105, 1, 5,
      'As soon as the room is free would be ideal.', 1794682490479, '{"id":105,"from":1,"to":5,"text":"As soon as the room is free would be ideal.","at":1794682490479}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      106, 5, 1,
      'I''d love to view it. Are you free this weekend?', 1794682494228.925, '{"id":106,"from":5,"to":1,"text":"I''d love to view it. Are you free this weekend?","at":1794682494228.925,"read":true}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      107, 1, 5,
      'Weekday evenings work best for me.', 1794682507541, '{"id":107,"from":1,"to":5,"text":"Weekday evenings work best for me.","at":1794682507541}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      108, 5, 1,
      'I''m a medical student based in Faisalabad.', 1794682509961.4958, '{"id":108,"from":5,"to":1,"text":"I''m a medical student based in Faisalabad.","at":1794682509961.4958,"read":true}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      109, 1, 5,
      'k', 1794682525099, '{"id":109,"from":1,"to":5,"text":"k","at":1794682525099}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      110, 5, 1,
      'Sounds good!', 1794682529072.914, '{"id":110,"from":5,"to":1,"text":"Sounds good!","at":1794682529072.914,"read":true}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      111, 1, 5,
      'Sounds good!', 1794682540665, '{"id":111,"from":1,"to":5,"text":"Sounds good!","at":1794682540665}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      112, 5, 1,
      'Sounds good!', 1794682543015.8118, '{"id":112,"from":5,"to":1,"text":"Sounds good!","at":1794682543015.8118,"read":true}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      114, 1, 5,
      'Sounds good!', 1794750796256, '{"id":114,"from":1,"to":5,"text":"Sounds good!","at":1794750796256}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      115, 5, 1,
      'Sounds good!', 1794750800171.7498, '{"id":115,"from":5,"to":1,"text":"Sounds good!","at":1794750800171.7498,"read":true}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      116, 1, 5,
      'Sounds good!', 1795017498897, '{"id":116,"from":1,"to":5,"text":"Sounds good!","at":1795017498897}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      117, 5, 1,
      'Sounds good!', 1795017502408.8018, '{"id":117,"from":5,"to":1,"text":"Sounds good!","at":1795017502408.8018,"read":true}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      118, 1, 5,
      'Sounds good!', 1795619517496, '{"id":118,"from":1,"to":5,"text":"Sounds good!","at":1795619517496}'
    );

INSERT OR REPLACE INTO messages
    (id, from_user, to_user, message_text, created_at, data_json)
    VALUES (
      119, 1, 5,
      'hello', 1795632872696, '{"id":119,"from":1,"to":5,"text":"hello","at":1795632872696}'
    );

INSERT OR REPLACE INTO feedback
    (id, by_user, target_user, value, created_at, data_json)
    VALUES (
      120, 1, 2,
      'like', 1795633282558, '{"id":120,"by":1,"target":2,"value":"like","at":1795633282558}'
    );


