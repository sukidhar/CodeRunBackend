module.exports = {
  findGameUserQuery: `MATCH (user:GameUser{email:$email}) RETURN user.email as email, user.id as id, user.username as username, user.password as password`,
  registerQuery: `CREATE (user : GameUser {id:$id,email:$email,username:$nickname,password:$password,joinedAt:$time}) RETURN user.id as id,user.email AS email, user.username AS username`,
  getChaptersQuery: `MATCH (chapter:Chapter) with chapter OPTIONAL MATCH (chapter)<-[r]-(gameUser:GameUser) WHERE gameUser.id = $id RETURN type(r) as relation,chapter.id as id,chapter.title as title,chapter.description as description,chapter.order as order ORDER BY chapter.order LIMIT 20`,
  getAllChaptersQuery: `MATCH (language:Language)<-[r:BelongsTo]-(chapter:Chapter)
  WITH language,r,chapter
  OPTIONAL MATCH (language)<-[r]-(chapter)<-[relation]-(user:GameUser)
  WHERE user.id = $id
  RETURN language.title as language,chapter.id as chapterID,chapter.title as chapterTitle,chapter.description as chapterDescription,chapter.tag as tag,type(relation) as status
  ORDER BY language,tag`,
  startChapterQuery: `MATCH (user:GameUser) where user.id = $userId
  WITH user
  MATCH (chapter:Chapter) where chapter.id = $chapterId
  MERGE (user)-[relation:IsCurrentlyPlaying]->(chapter)
  with user,chapter
  MATCH (chapter)-[r:HasGate]->(gate)
  RETURN chapter.id as chapterId, gate.id as gateId, gate.title as gateTag,gate.exp as exp,gate.question as question,gate.answer as gateKey,exists((gate)-[r:CheckPoint]-(user)) as isCheckPoint
  ORDER BY gateTag`,
  findGateByID: `MATCH (gate:Gate) WHERE gate.id = $gateId return gate.id as id,gate.exp as exp,gate.answer as answer`,
  setCheckPointQuery: `MATCH (gate:Gate) WHERE gate.id = $gateId WITH gate
  MATCH (user:GameUser) WHERE user.id = $userId
  MERGE (user)-[r:CheckPoint{exp:$exp}]->(gate)`,
  startUpQueries: [
    `CREATE CONSTRAINT unique_game_user_id IF NOT EXISTS ON (user:GameUser) ASSERT user.id IS UNIQUE`,
    `CREATE CONSTRAINT unique_email IF NOT EXISTS ON (user:GameUser) ASSERT user.email IS UNIQUE`,
    `CREATE CONSTRAINT email_required IF NOT EXISTS ON (user:GameUser) ASSERT user.email IS NOT NULL`,
    `CREATE CONSTRAINT user_id_required IF NOT EXISTS ON (user:GameUser) ASSERT user.id IS NOT NULL`,
  ],
};
