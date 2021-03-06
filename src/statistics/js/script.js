'use strict';
{

    let headers = new Headers();

    let toBase64 = (input) => {
        return window.btoa(decodeURIComponent(encodeURIComponent(input)));
    };

    let getLoggedHours = (storage) => {
        headers.append('Authorization', 'Basic ' + toBase64(storage.login + ':' + storage.password));
        headers.append('Content-Type', 'application/json');
        storage.lookups = [];

        return new Promise((resolve, reject) => {
            storage.fromDate = document.getElementById('dateFrom').value;
            storage.toDate = document.getElementById('dateTo').value;
            storage.lookups = [];
            storage.users = [];

            // let workLogDates = ` and worklogDate >= ${storage.fromDate} and worklogDate <= ${storage.toDate}`;

            //To get all relevant JIRAs, we currently need to get all that have been updated from the starting date.
            //This is because we can't search for sub-tasks that are in epics, since it's the parent that's in the epic.
            //The parent gets it's updateDate updated when a sub-task is added or modified. But that also means that the updatedDate can be later then the period we're looking for
            //That's why we need to get all from the periods start date...
            storage.jiraReview = (storage.jql + ' and updatedDate >= ' + storage.fromDate).replace(/"/g, '\'');

            fetch(`${storage.url}/rest/api/2/search?jql=${storage.jiraReview}&maxResults=1000`, {
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
                    if (jiras.total === 1000) {
                        throw error('Possibly more then 1000 JIRAs returned - please refine your query for accurate results.');
                    }

                    storage.analyzedTotal = jiras.total;
                    storage.fromDate = new Date(storage.fromDate);
                    storage.toDate = new Date(storage.toDate);
                    storage.report = {};
                    storage.report.total = 0;
                    storage.report.issues = {};

                    for (let issue of jiras.issues) {
                        if (issue.fields.issuetype.subtask === false) {
                            storage.lookups.push(getDetails(issue.self, storage));
                        }
                    }

                    Promise.all(storage.lookups).then(() => {
                        console.table(storage.report);
                        resolve(storage);
                    }, reason => {
                        debugger;
                        notify({
                            icon: 'glyphicon-exclamation-sign',
                            type: 'danger',
                            title: 'Huston! We have a problem!',
                            message: reason.message + ' - Please try again!'
                        });

                        console.log(reason);
                        reject(reason);
                    })
                })
                .catch(function (err) {
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
        return new Promise((resolve, reject) => {
            let lookups = [];

            lookups.push(fetch(url, {
                method: 'GET',
                redirect: 'follow',
                headers: headers
            }).then(response => {
                if (!response.ok) {
                    throw Error(response.statusText);
                }
                return response.json()
            })
                .then(issueDetails => {
                    let thisDate = '';
                    let key = issueDetails.key;
                    let user = '';


                    for (let log of issueDetails.fields.worklog.worklogs) {
                        thisDate = new Date(log.updated.split('T')[0]);

                        if (thisDate >= storage.fromDate && thisDate <= storage.toDate) {
                            if (!storage.report.issues[key]) {
                                storage.report.issues[key] = {};
                                storage.report.issues[key].details = {};
                                storage.report.issues[key].data = [];
                            }

                            storage.report.issues[key].details.key = key;
                            storage.report.issues[key].details.author = log.updateAuthor.displayName;
                            storage.report.issues[key].details.type = issueDetails.fields.issuetype.name;
                            storage.report.issues[key].details.status = issueDetails.fields.status.name;
                            storage.report.issues[key].details.summary = issueDetails.fields.summary;

                            user = encodeURIComponent(log.updateAuthor.displayName);

                            if(typeof storage[user] !== 'undefined'){
                                if(storage[user] === true){
                                    storage.report.total += log.timeSpentSeconds;
                                }
                            }else{ //No selection made for user, so assume it should be included
                                storage.report.total += log.timeSpentSeconds;
                            }

                            storage.users.push(log.updateAuthor.displayName);

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

                    Promise.all(lookups).then(() => {
                        resolve();
                    })

                })
                .catch(function (err) {
                    notify({
                        icon: 'glyphicon-exclamation-sign',
                        type: 'danger',
                        title: 'Huston! We have a problem!',
                        message: err.message + ' - Please try again!'
                    });

                    console.log(err);
                }))
        })
    };

    let createReport = (storage) => {
        return new Promise((resolve, reject) => {
            let data = storage.report;
            let holder = document.getElementById('holder');
            let loading = document.getElementById('loading');
            let total = 0;
            let html = '<h3>Total hours for period: <span id="total"></span></h3><table id="report" class="table table-striped table-bordered table-hover"><tr><th>ID</th><th>Type</th><th>Summary</th><th>Status</th><th>User</th><th>Date</th><th>Hours</th></tr>';
            let users = null;
            let user = '';
            let htmlUsers = '<ul>';
            let isHidden = false;

            users = [...(new Set(storage.users))].sort();

            for (let user of users) {
                htmlUsers += `<li><label><input type="checkbox" checked id="${encodeURIComponent(user)}">${user}</label></li>`;
            }
            htmlUsers += '</ul>';

            document.getElementById('users').innerHTML = htmlUsers;

            for (let [key, value] of Object.entries(data)) {
                if (key === 'total') {
                    total = value;
                } else {
                    for (let [key, data] of Object.entries(value)) {
                        let row = '';
                        let hours = 0;

                        for (let log of data.data) {
                            isHidden = false;
                            user = encodeURIComponent(log.displayName);

                            if(typeof storage[user] !== 'undefined'){
                                isHidden = storage[user] !== true;
                            }

                            hours = (log.timeSpentSeconds / 3600).toFixed(2);

                            row += `<tr ${(isHidden ? 'class="hide-row"' : '')} data-user="${encodeURIComponent(log.displayName)}"><td><a href="${storage.url}/browse/${key}" target="_blank" rel="noopener">${key}</a></td><td>${data.details.type}</td><td>${data.details.summary}</td><td>${data.details.status}</td>`;
                            row += `<td>${log.displayName}</td><td>${log.updated}</td><td data-hours="${hours}">${hours}</td></tr>`;
                        }

                        html += row;
                    }
                }
            }

            html += '</tr></table>';
            holder.innerHTML = html;
            document.getElementById('total').innerHTML = (parseInt(data.total) / 3600).toFixed(2);

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

        if (fromDate === '' || toDate === '') {
            return notify({
                icon: 'glyphicon-exclamation-sign',
                type: 'danger',
                title: 'Huston! We have a problem!',
                message: 'Both FROM & TO dates need to specified.'
            });
        }

        if (toDate < fromDate) {
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

        chrome.storage.local.get(null, function (storage) {
            getLoggedHours(storage)
                .then(data => createReport(data).then(() => {
                    let check = null;

                    for (let [key, isChecked] of Object.entries(storage)) {
                        if(key.indexOf('%20') > -1){
                            check = document.getElementById(key);

                            if(check){
                                check.checked = isChecked;
                            }
                        }
                    }

                    setTimeout(() => {
                        notify({
                            icon: 'glyphicon-ok',
                            type: 'info',
                            title: 'Report is ready!',
                            message: `<div>I've analyzed ${storage.analyzedTotal} JIRAs in total.</div> Remember that you can copy and paste the report into Excel if required.`,
                            url: storage.url + '/issues/?jql=' + storage.jiraReview,
                        })
                    }, 1000)

                }));
        })
    };

    let getUsers = () => {
        let users = document.querySelectorAll('#users input[type="checkbox"]:checked');
        let thisUser = event.target;
        let rows = document.querySelectorAll(`tr[data-user="${thisUser.id}"]`);
        let data = {};
        let isVisible = thisUser.checked;
        let total = 0;

        for (let row of rows) {
            if (isVisible) {
                if (row.classList.contains('hide-row')) {
                    row.classList.remove('hide-row');
                }

                if (!row.classList.contains('show-row')) {
                    row.classList.add('show-row');
                }
            }else{
                if (row.classList.contains('show-row')) {
                    row.classList.remove('show-row');
                }

                if (!row.classList.contains('hide-row')) {
                    row.classList.add('hide-row');
                }
            }
        }

        document.querySelectorAll('tr:not(.hide-row) td[data-hours]').forEach((td) => {
            total += parseFloat(td.dataset.hours);
        });

        document.getElementById('total').innerText = total;

        for (let user of users) {
            data[user.id] = user.checked;
        }

        data[thisUser.id] = thisUser.checked; //Store the current change as well.

        chrome.storage.local.set(data);
    };

    let notify = (config) => {
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
        document.getElementById('users').addEventListener('change', getUsers);

    };

    init();

}