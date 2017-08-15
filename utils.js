
function createVideoId(uid) {
    var videoId = Math.round(Date.now() * Math.random());
    if(uid != null)
    {
        var cominedId =  videoId.toString() + uid.toString();

        return cominedId;
    }
    return videoId;
}

module.exports = {
    createVideoId:createVideoId
};
