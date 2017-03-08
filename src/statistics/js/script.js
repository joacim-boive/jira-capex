'use strict';
{

    let headers = new Headers();
    let lookups = [];

    let toBase64 = (input) => {
        return window.btoa(decodeURIComponent(encodeURIComponent(input)));
    };

    let getLoggedHours = (storage) => {
        headers.append('Authorization', 'Basic ' + toBase64(storage.login + ':' + storage.password));
        headers.append('Content-Type', 'application/json');

        return new Promise((resolve, reject) => {
            storage.fromDate = document.getElementById('dateFrom').value;
            storage.toDate = document.getElementById('dateTo').value;

            let workLogDates = ` and worklogDate >= ${storage.fromDate} and worklogDate <= ${storage.toDate}`;

            fetch(`${storage.url}/rest/api/2/search?jql=${storage.jql + workLogDates}&maxResults=1000`, {
                method: 'GET',
                redirect: 'follow',
                headers: headers
            })
                .then(response => {
                    return response.json()
                })
                .then(jiras => {

                    storage.fromDate = new Date(storage.fromDate);
                    storage.toDate = new Date(storage.toDate);
                    storage.report = {};
                    storage.report.total = 0;
                    storage.report.issues = {};

                    for (let issue of jiras.issues) {
                        if (issue.fields.issuetype.subtask === false) {
                            lookups.push(getDetails(issue.self, storage));
                        }
                    }

                    Promise.all(lookups).then(() => {
                        console.table(storage.report);
                        resolve(storage);
                    }, reason => {
                        debugger;
                        console.log(reason);
                        reject(reason);
                    })
                })
        })
    };

    let getDetails = (url, storage) => {
        return fetch(url, {
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
                        storage.report.issues[key].details.type = issueDetails.fields.issuetype.name;
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

                for(let task of issueDetails.fields.subtasks){
                    debugger;
                    lookups.push(getDetails(task.self, storage));
                }
            });
    };

    let createReport = (storage) => {
        let data = storage.report;
        let holder = document.getElementById('holder');
        let loading = document.getElementById('loading');
        let total = 0;
        let html = '<h3>Total hours for period: <span id="total"></span></h3><table id="report" class="table table-striped table-bordered table-hover"><tr><th>ID</th><th>Type</th><th>Summary</th><th>Status</th><th>User</th><th>Date</th><th>Hours</th></tr>';

        for (let [key, value] of Object.entries(data)) {
            if (key === 'total') {
                total = value;
            } else {
                for (let [key, data] of Object.entries(value)) {
                    const row = `<tr><td><a href="${storage.url}/browse/${key}" target="_blank" rel="noopener">${key}</a></td><td>${data.details.type}</td><td>${data.details.summary}</td><td>${data.details.status}</td>`;
                    let thisDetails = '';

                    for (let log of data.data) {
                        thisDetails += `${row}<td>${log.displayName}</td><td>${log.updated}</td><td>${log.timeSpentSeconds / 3600}</td></tr>`;
                    }

                    html += thisDetails;
                }
            }
        }

        html += '</tr></table>';
        holder.innerHTML = html;
        document.getElementById('total').innerHTML = parseInt(data.total) / 3600;

        loading.classList.add('bounceOut');
        holder.classList.add('bounceIn');
        holder.classList.remove('hide');
    };

    let getStorage = () => {
        let loading = document.getElementById('loading');
        let holder = document.getElementById('holder');

        holder.classList.add('hide');
        holder.classList.remove('bounceIn');

        loading.classList.remove('bounceOut');
        loading.classList.remove('hide');

        headers = new Headers();
        lookups = [];

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