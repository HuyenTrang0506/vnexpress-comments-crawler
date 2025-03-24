var Xray = require('x-ray');
var fs = require('fs');
var request = require('request');
var xlsx = require('xlsx'); // Add xlsx library

// Function to download comments with pagination
var downloadComments = function(offset, limit, articleId, siteId, categoryId, callback) {
    var comment_params = {
        callback: 'okmen',
        offset: offset,
        limit: limit,
        frommobile: 0,
        sort: 'like',
        objectid: articleId,
        objecttype: 1,
        siteid: siteId,
        categoryid: categoryId,
        usertype: 4,
        template_type: 1,
    };

    var url_param = Object.keys(comment_params)
        .map(function(k) {
            return k + '=' + comment_params[k];
        })
        .join('&');

    var comment_url = `https://usi-saas.vnexpress.net/index/get?` + url_param;

    request(comment_url, function(error, response, body) {
        if (error) {
            return callback(error);
        }
        if (response.statusCode !== 200) {
            return callback('Response status was ' + response.statusCode);
        }

        // Remove JSONP wrapper (e.g., `okmen(...)`)
        var jsonBody = body.replace(/^\/\*\*\/ typeof okmen === 'function' && okmen\(|\);$/g, '');

        try {
            var jsonData = JSON.parse(jsonBody);
            callback(null, jsonData);
        } catch (parseError) {
            callback('Failed to parse JSON: ' + parseError.message);
        }
    });
};

// Initialize Xray instance
var x = Xray({
    filters: {
        trim: function(value) {
            return typeof value === 'string' ? value.trim() : value;
        }
    }
});

// The specific news article URL
var newsUrl = 'https://vnexpress.net/tre-lan-khong-ra-gia-an-khong-toi-4663261.html';

// Scraping logic for the specific article
x(newsUrl, {
    title: 'h1.title-detail | trim',
    tt_site_id: '[name="tt_site_id"]@content',
    tt_category_id: '[name="tt_category_id"]@content',
    tt_article_id: '[name="tt_article_id"]@content',
})((err, res) => {
    if (err) {
        console.error('Error scraping the article:', err);
        return;
    }

    var limit = 1000; // Number of comments per request
    var offset = 0; // Initial offset
    var commentsArray = []; // To store all comments

    // Function to recursively fetch comments until no more are found
    function fetchAllComments(offset) {
        downloadComments(offset, limit, res.tt_article_id, res.tt_site_id, res.tt_category_id, function(err, body) {
            if (err) {
                console.error('Error downloading comments:', err);
                return;
            }

            var newComments = body.data.items
                .map(comment => {
                    var cleanedComment = comment.content
                        .replace(/<br\s*\/?>/gi, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, ' ')
                        .replace(/&lt;/g, ' ')
                        .trim();
                    return {
                        article_id: res.tt_article_id,
                        comment: cleanedComment,
                        user: comment.full_name,
                        created_at: comment.time,
                    };
                })
                .filter(c => c.comment.length >= 200); // Only include comments >= 200 characters

            commentsArray = commentsArray.concat(newComments);

            console.log(`Fetched ${newComments.length} comments from offset ${offset}. Total: ${commentsArray.length}`);

            // If fewer comments returned than limit, stop fetching
            if (newComments.length < limit) {
                saveCommentsToFiles(commentsArray);
                return;
            }

            // Fetch next batch
            fetchAllComments(offset + limit);
        });
    }

    // Start fetching comments
    fetchAllComments(offset);

    // Function to save comments to CSV and XLSX
    function saveCommentsToFiles(comments) {
        // Convert comments to CSV format
        var csvData = comments.map(c => `${c.article_id}; ${c.comment}; "${c.user}"; "${c.created_at}"`).join('\n');

        // Save to comments.csv
        //fs.writeFile('comments.csv', csvData + '\n', (err) => {
        //    if (err) {
        //        console.error('Error writing to comments.csv:', err);
        //    } else {
        //        console.log('Comments saved to comments.csv successfully.');
        //    }
        //});

        // Save to XLSX
        var wb = xlsx.utils.book_new();
        var ws_data = [["Article ID", "Comment", "User", "Created At"]]; // Define header

        comments.forEach(c => {
            ws_data.push([c.article_id, c.comment, c.user, c.created_at]);
        });

        var ws = xlsx.utils.aoa_to_sheet(ws_data);
        xlsx.utils.book_append_sheet(wb, ws, "Comments");
        xlsx.writeFile(wb, 'comments.xlsx');
        console.log('Comments saved to comments.xlsx successfully.');
    }
});
