'use strict';
{

    let toBase64 = (input) => {
        return window.btoa(decodeURIComponent(encodeURIComponent(input)));
    };

    let getLoggedHours = (storage) => {
        const headers = new Headers({
            'Authorization': 'Basic ' + toBase64(storage.login + ':' + storage.password),
            'Content-Type': 'application/json'
        });

        return new Promise((resolve, reject) => {
            storage.fromDate = document.getElementById('dateFrom').value;
            storage.toDate = document.getElementById('dateTo').value;

            let workLogDates = ` and worklogDate >= ${storage.fromDate} & worklogDate <= ${storage.toDate}`;

            fetch(`${storage.url}/rest/api/2/search?jql=${storage.jql + workLogDates}&maxResults=1000`, {
                method: 'GET',
                redirect: 'follow',
                headers: headers
            })
                .then(response => {
                    return response.json()
                })
                .then(jiras => {
                    let lookups = [];

                    storage.fromDate = new Date(storage.fromDate);
                    storage.toDate = new Date(storage.toDate);
                    storage.report = {};
                    storage.report.total = 0;
                    storage.report.issues = {};

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
                                        let thisDate = '';
                                        let key = issueDetails.key;

                                        for (let log of issueDetails.fields.worklog.worklogs) {
                                            thisDate = new Date(log.updated.split('T')[0]);

                                            if (thisDate >= storage.fromDate && thisDate <= storage.toDate) {
                                                if (!storage.report.issues[key]) {
                                                    storage.report.issues[key] = {};
                                                    storage.report.issues[key].details = {};
                                                    storage.report.issues[key].data = [];
                                                }

                                                storage.report.issues[key].details.key = key;
                                                storage.report.issues[key].details.status = issueDetails.fields.status.name;
                                                storage.report.issues[key].details.summary = issueDetails.fields.summary;

                                                storage.report.total += log.timeSpentSeconds;

                                                storage.report.issues[key].data.push({
                                                    'updated': log.updated,
                                                    'displayName': log.updateAuthor.displayName,
                                                    'timeSpentSeconds': log.timeSpentSeconds
                                                })
                                            }
                                        }
                                    })
                            )
                        }
                    }


                    Promise.all(lookups).then(() => {
                        console.table(storage.report);
                        resolve(storage.report);
                    }, reason => {
                        debugger;
                        console.log(reason);
                        reject(reason);
                    })
                })
        })
    };

    let createReport = (data) => {
        let holder = document.getElementById('holder');
        let loading = document.getElementById('loading');
        let total = 0;
        let html = '<table class="table table-striped table-bordered table-hover"><tr><th>ID</th><th>Summary</th><th>Status</th><th>User</th><th>Date</th><th>Hours</th></tr>';

        for (let [key, value] of Object.entries(data)) {
            if (key === 'total') {
                total = value;
            } else {
                for (let [key, data] of Object.entries(value)) {
                    const row = `<tr><td>${key}</td><td>${data.details.summary}</td><td>${data.details.status}</td>`;
                    let thisDetails = '';

                    for (let log of data.data) {
                        thisDetails += `${row}<td>${log.displayName}</td><td>${log.updated}</td><td>${log.timeSpentSeconds}</td></tr>`;
                    }

                    html += thisDetails;
                }
            }
        }

        html += '</tr></table>';

        holder.innerHTML = html;

        loading.classList.add('bounceOut');
        holder.classList.add('bounceIn');
        holder.classList.remove('visuallyhidden');
    };

    let getStorage = () => {
        let loading = document.getElementById('loading');

        loading.classList.remove('hide');

        chrome.storage.local.get({
            'url': '',
            'login': '',
            'password': '',
            'jql': ''
        }, function (storage) {
            getLoggedHours(storage).then(data => createReport(data));
        })
    };


    let init = () => {
        Flatpickr.l10ns.default.firstDayOfWeek = 1;

        flatpickr('.flatpickr', {
            wrap: true,
            weekNumbers: true, // show week numbers
            maxDate: new Date()
        });

        document.querySelectorAll('input').forEach((input) => {
            input.addEventListener('onclick', () => {
                let data = {};

                data[input.id] = input.value;

                chrome.storage.local.set(data);
            })
        });

        document.getElementById('doIt').addEventListener('click', getStorage);

    };

    init();

}