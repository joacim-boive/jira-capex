'use strict';
{
    let toBase64 = input => {
        return window.btoa(decodeURIComponent(encodeURIComponent(input)));
    };

    let getLoggedHours = (storage) => {
        const headers = new Headers({
            'Authorization': 'Basic ' + toBase64(storage.login + ':' + storage.password),
            'Content-Type': 'application/json'
        });

        let lookups = [];

        return new Promise((resolve, reject) => {
            fetch(`${storage.url}/rest/api/2/search?jql=${storage.jql}&maxResults=1000`, {
                method: 'GET',
                redirect: 'follow',
                headers: headers
            })
                .then(response => {
                    return response.json()
                })
                .then(jiras => {
                    for (let issue of jiras.issues) {
                        if (issue.fields.issuetype.subtask === false) {
                            lookups.push(fetch(issue.self, {
                                    method: 'GET',
                                    redirect: 'follow',
                                    headers: headers
                                }).then(response => {
                                    return response.json()
                                })
                                    .then(issueDetails => {
                                        for (let log of issueDetails.fields.worklog.worklogs) {
                                            debugger;
                                        }
                                    })
                            )
                        }
                    }

                    Promise.all(lookups).then(() => {
                        console.table(users);
                        resolve(users);
                    }, reason => {
                        debugger;
                        console.log(reason);
                        reject(reason);
                    })
                })
        })
    };

    let createReport = (data) => {
        debugger;
    };

    chrome.storage.local.get({
        'url': '',
        'login': '',
        'password': '',
        'jql': ''
    }, function (storage) {
        getLoggedHours(storage).then(data => createDataset(data));
    })
}