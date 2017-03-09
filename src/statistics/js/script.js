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

            storage.jiraReview = storage.jql + workLogDates;

            fetch(`${storage.url}/rest/api/2/search?jql=${storage.jql + workLogDates}&maxResults=1000`, {
                method: 'GET',
                redirect: 'follow',
                headers: headers
            })
                .then(response => {
                    if (!response.ok) {
                        throw Error(response.statusText);
                    }
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
                .catch(function(err) {
                    notify({
                        icon: 'glyphicon-exclamation-sign',
                        type: 'danger',
                        title: 'Huston! We have a problem!',
                        message: err.message + ' - Please try again!'
                    });

                    console.log(err);
                });
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
                            'updated': log.updated.replace('T', ' ').split('.000')[0],
                            'displayName': log.updateAuthor.displayName,
                            'timeSpentSeconds': log.timeSpentSeconds
                        })
                    }
                }

                for (let task of issueDetails.fields.subtasks) {
                    lookups.push(getDetails(task.self, storage));
                }
            });
    };

    let createReport = (storage) => {
        return new Promise((resolve, reject) => {
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

            resolve();
        })
    };

    let getStorage = () => {
        let loading = document.getElementById('loading');
        let holder = document.getElementById('holder');
        let fromDate = document.getElementById('dateFrom').value;
        let toDate = document.getElementById('dateTo').value;

        if(fromDate === '' || toDate === ''){
            return notify({
                icon: 'glyphicon-exclamation-sign',
                type: 'danger',
                title: 'Huston! We have a problem!',
                message: 'Both FROM & TO dates need to specified.'
            });
        }

        if(toDate < fromDate){
            return notify({
                icon: 'glyphicon-exclamation-sign',
                type: 'danger',
                title: 'Huston! We have a problem!',
                message: 'FROM date needs to be earlier then TO date'
            });
        }

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
            getLoggedHours(storage).then(data => createReport(data).then(() => {

                setTimeout(() =>{
                    notify({
                        icon: 'glyphicon-ok',
                        type: 'info',
                        title: 'Report is ready!',
                        message: 'Remember that you can copy and paste the report into Excel if required.',
                        url: storage.url + '/issues/?jql=' + storage.jiraReview,
                    })
                }, 1000)

            }));
        })
    };

    let notify = (config) =>{
        $.notify({
            // options
            icon: 'glyphicon ' + config.icon,
            title: config.title,
            message: config.message,
            url: config.url,
            target: '_blank'
        }, {
            // settings
            element: 'body',
            type: config.type,
            allow_dismiss: true,
            newest_on_top: true,
            showProgressbar: false,
            placement: {
                from: "top",
                align: "right"
            },
            offset: 20,
            spacing: 10,
            z_index: 1031,
            delay: 7000,
            timer: 1000,
            url_target: '_blank',
            mouse_over: true,
            animate: {
                enter: 'animated fadeInDown',
                exit: 'animated fadeOutUp'
            },
            icon_type: 'class',
            template: '<div data-notify="container" class="col-xs-11 col-sm-3 alert alert-{0}" role="alert">' +
            '<button type="button" aria-hidden="true" class="close" data-notify="dismiss">×</button>' +
            '<span data-notify="icon"></span> ' +
            '<span data-notify="title">{1}</span> ' +
            '<div>&nbsp;</div><span data-notify="message">{2}</span>' +
            '<div class="progress" data-notify="progressbar">' +
            '<div class="progress-bar progress-bar-{0}" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0%;"></div>' +
            '</div>' +
            '<a href="{3}" target="{4}" data-notify="url"></a>' +
            '</div>'
        });
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