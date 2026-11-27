UPDATE users
SET data_json = json_set(
  data_json,
  '$.sleep', 2,
  '$.clean', 5,
  '$.guests', 2,
  '$.noise', 2,
  '$.nosmoke', 1,
  '$.bio', 'Student at university, early riser, loves cooking and quiet evenings.',
  '$.profession', 'Student',
  '$.w', json('{"sleep":3,"clean":3,"guests":2,"noise":2}')
)
WHERE id = 1
  AND json_extract(data_json, '$.name') = 'Ayesha';
