const Twitter = require('twitter');
const moment = require('moment');

const env = process.env;
const SINCE_TIME_DURATION = env.SINCE_TIME_DURATION || 1;
const SINCE_TIME_UNIT = env.SINCE_TIME_UNIT || "hours";
const QUERIES = env.QUERIES.split(',');

const client = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

function search(query) {
    return client.get('search/tweets', {q: query, count: 100})
        .then(function (tweets) {
            return tweets.statuses.filter(function (tweet) {
                tweet.created_at = moment(tweet.created_at, "ddd MMM DD HH:mm:ss ZZ YYYY");
                return tweet.created_at.isAfter(moment().subtract(SINCE_TIME_DURATION, SINCE_TIME_UNIT));
            });
        });
}

function retweet(promise) {
    return promise.then(function (tweets) {
        return Promise.all(tweets.map(function (tweet) {
            return client.post('statuses/retweet/' + tweet.id_str, {})
                .then(function () {
                    console.log(tweet.id_str, tweet.created_at, tweet.text);
                })
                .catch(console.error)
        }))
    })
}

Promise.all(QUERIES.map(search)
    .map(retweet))
    .catch(console.error)
    .then(function () {
        console.log("done")
    });
