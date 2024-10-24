var Xray = require('x-ray');
var fs = require('fs');
var request = require('request');
var xlsx = require('xlsx');  // Add xlsx library

// Function to download comments
var downloadComments = function(url, cb) {
    request(url, function(error, response, body) {
        if (error) {
            return cb(error);
        }
        if (response.statusCode !== 200) {
            return cb('Response status was ' + response.statusCode);
        }

        // Remove JSONP wrapper (e.g., `okmen(...)`)
        var jsonBody = body.replace(/^\/\*\*\/ typeof okmen === 'function' && okmen\(|\);$/g, '');

        try {
            var jsonData = JSON.parse(jsonBody);
            cb(null, jsonData);
        } catch (parseError) {
            cb('Failed to parse JSON: ' + parseError.message);
        }
    });
};

// Initialize Xray instance
var x = Xray({
    filters: {
        trim: function (value) {
            return typeof value === 'string' ? value.trim() : value;
        }
    }
});

// The specific news article URL
var newsUrl = 'https://vnexpress.net/xa-hoi-hoa-mot-chiec-laptop-4800323.html';

// Scraping logic for the specific article
x(newsUrl, {
    title: 'h1.title-detail | trim', // Updated selector
    tt_site_id: '[name="tt_site_id"]@content',
    tt_category_id: '[name="tt_category_id"]@content',
    tt_article_id: '[name="tt_article_id"]@content',
    tt_page_type: '[name="tt_page_type"]@content',
    box_comment_vne: '#box_comment_vne@data-component-value'
})((err, res) => {
    if (err) {
        console.error('Error scraping the article:', err);
        return;
    }

    // Prepare to download comments
    var comment_params = {
        callback: 'okmen',
        offset: 0,
        limit: 1000,
        frommobile: 0,
        sort: 'like',
        objectid: res.tt_article_id,
        objecttype: 1,
        siteid: res.tt_site_id,
        categoryid: res.tt_category_id,
        usertype: 4,
        template_type: 1,
    };

    var url_param = Object.keys(comment_params).map(function(k) {
        return k + '=' + comment_params[k];
    }).join('&');

    var comment_url = `https://usi-saas.vnexpress.net/index/get?` + url_param;

    // Download comments and save to CSV and XLSX
    downloadComments(comment_url, function(err, body) {
        if (err) {
            console.error('Error downloading comments:', err);
            return;
        }

        // Assume body is in JSON format
        var commentsData = body;
        var commentsArray = commentsData.data.items.map(comment => {
            // Remove <br /> tags and trim the comment
            var cleanedComment = comment.content.replace(/<br\s*\/?>/gi, '').trim();
            return {
                article_id: res.tt_article_id,
                comment: cleanedComment,  // Cleaned comment text
                user: comment.full_name,   // Assuming `full_name` contains user information
                created_at: comment.time    // Assuming `time` contains the timestamp
            };
        });

        // Convert comments to CSV format using semicolon as separator
        var csvData = commentsArray.map(c => `${c.article_id}; ${c.comment}; "${c.user}"; "${c.created_at}"`).join('\n');

        // Save to comments.csv (overwrites previous data)
        fs.writeFile('comments.csv', csvData + '\n', (err) => {
            if (err) {
                console.error('Error writing to comments.csv:', err);
            } else {
                console.log('Comments saved to comments.csv successfully.');
            }
        });

        // Save to XLSX file
        var wb = xlsx.utils.book_new();
        var ws_data = [["Article ID", "Comment", "User", "Created At"]];  // Define header

        // Add comment data
        commentsArray.forEach(c => {
            ws_data.push([c.article_id, c.comment, c.user, c.created_at]);
        });

        // Create worksheet and add data
        var ws = xlsx.utils.aoa_to_sheet(ws_data);
        xlsx.utils.book_append_sheet(wb, ws, "Comments");

        // Write XLSX file
        xlsx.writeFile(wb, 'comments.xlsx');
        console.log('Comments saved to comments.xlsx successfully.');
    });
});
