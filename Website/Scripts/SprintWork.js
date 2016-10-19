var settings = undefined;
var youTrackIds = [];
var youTrackHeaders = [];
var reportItems = [];
var apiStarted = 0;
var apiCompleted = 0;
var issuesToAnalyze = 0;

$(document).ready(function () {
    StartPageLoad();
});

function StartPageLoad() {
    settings = undefined;
    youTrackIds = [];
    youTrackHeaders = [];
    apiStarted = 0;
    apiCompleted = 0;
    issuesToAnalyze = 0;

    $("body").empty();

    DrawHeader();

    LoadSettings();
}

function DrawHeader() {
    var markUp = "<div class='header-bar'>";
    markUp += "<a href='index.html' class='Header-Command'>Home</a>";
    markUp += "<a onclick='javascript:RefreshData();' class='Header-Command'>Refresh Data</a>";
    markUp += "</div>";
    $("body").append(markUp);
}

function LoadSettings() {
    $.ajax({
        type: "Get",
        url: "./Data/SiteSettings.json",
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            settings = jsonData;
            LoadHeadersFromYouTrack();
        }
    });
}

function LoadHeadersFromYouTrack() {
    var apiUrl = settings.YouTrackRootUrl + "/rest/issue?filter=";
    var filterQuery = "Type: {User Story}, {Bug}, {Defect} State: -Closed";

    filterQuery += " Sprint: ";
    for (var teamIndex in settings.Teams) {
        if (teamIndex > 0)
            filterQuery += ", ";

        filterQuery += "{" + settings.Teams[teamIndex].Sprint.Name + "}";
    }

    filterQuery += " order by: {issue id} asc"

    apiUrl += encodeURI(filterQuery) + "&max=500";

    $("body").append("<div class='progress'>Loading Headers from You Track.</div>");

    apiStarted++;

    $.ajax({
        url: apiUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            StoreYouTrackHeaders(jsonData);
            apiCompleted += 1;
        },
        error: function () {
            apiCompleted += 1;
        }
    });

    setTimeout(function () { WaitToLoadYouTrackIssueData() }, 1000);
}

function StoreYouTrackHeaders(youTrackData) {
    for (var taskIndex in youTrackData.issue) {
        var task = youTrackData.issue[taskIndex];

        if (youTrackIds.indexOf(task.id) > -1) continue;

        youTrackIds.push(task.id);

        var header = new Object();
        header.Type = "User Story";
        header.Id = task.id;
        header.State = "Unknown";
        header.Title = "Unknown";

        for (var fieldIndex in task.field) {
            var field = task.field[fieldIndex];

            if (field.name === "Type") header.Type = field.value[0];
            if (field.name === "summary") header.Title = field.value;
            if (field.name === "State") header.State = field.value[0];
        }

        youTrackHeaders.push(header);
    }
}

function WaitToLoadYouTrackIssueData() {
    if (apiStarted > apiCompleted)
        setTimeout(function () { WaitToLoadYouTrackIssueData() }, 1000);
    else
        LoadYouTrackIssueData();
}

function LoadYouTrackIssueData() {
    for (var headerIndex in youTrackHeaders) {
        var youTrackHeader = youTrackHeaders[headerIndex];
        var apiUrl = settings.YouTrackRootUrl + "/rest/issue?filter=";
        var filterQuery = "Subtask of: " + youTrackHeader.Id;

        apiUrl += encodeURI(filterQuery) + "&max=500";

        apiStarted++;

        RequestYouTrackIssueData(apiUrl, youTrackHeader.Id, youTrackHeader.Type, youTrackHeader.Title, youTrackHeader.State);
    }

    WaitToDisplayResults();
}

function RequestYouTrackIssueData(apiUrl, issueId, issueType, issueTitle, issueState) {
    $.ajax({
        url: apiUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            AnalyzeYouTrackIssueData(jsonData, issueId, issueType, issueTitle, issueState);
            apiCompleted += 1;
        },
        error: function () {
            apiCompleted += 1;
        }
    });
}

function AnalyzeYouTrackIssueData(youTrackData, issueId, issueType, issueTitle, issueState) {
    var preMergePending = false;
    var poReviewPending = false;
    var postMergePending = false;
    var mergePending = false;
    var newReportItem = new Object();
    newReportItem.Id = issueId;
    newReportItem.Title = issueTitle;
    newReportItem.Type = issueType;
    newReportItem.State = issueState;
    newReportItem.DevRemaining = 0;
    newReportItem.QARemaining = 0;
    newReportItem.DevContributors = [];

    var allowedStates = ["Submitted", "Designing", "Ready to Start", "In Progress"];

    for (var taskIndex in youTrackData.issue) {
        var task = youTrackData.issue[taskIndex];
        var taskTitle = "Unknown";
        var taskType = "Unknown";
        var taskEstimate = 0;
        var workRemaining = 0;
        var taskOwner = "Unknown";
        var taskState = "Unknown";
        var updatedOwner = false;

        for (var fieldIndex in task.field) {
            var field = task.field[fieldIndex];

            if (field.name === "Type") taskType = field.value[0];
            if (field.name === "Estimate") taskEstimate = parseInt(field.value[0]);
            if (field.name === "WorkRemaining") workRemaining = parseInt(field.value[0]);
            if (field.name === "Assignee") taskOwner = field.value[0].fullName;
            if (field.name === "summary") taskTitle = field.value.toLowerCase();
            if (field.name === "State") taskState = field.value[0];
        }

        if (newReportItem.DevContributors.indexOf(taskOwner) === -1 && taskOwner !== "Unknown" && taskOwner !== "I'm Blocked")
            newReportItem.DevContributors.push(taskOwner);

        if (allowedStates.indexOf(taskState) === -1)
            continue;

        if (workRemaining === 0 && taskEstimate !== 0)
            workRemaining = taskEstimate;

        if (taskType === "Task" || taskType === "Rework Task") newReportItem.DevRemaining += workRemaining;

        if (taskType === "Merge") mergePending = true;
        if (taskType === "Product Owner Review") poReviewPending = true;

        if (taskType === "Testing Task") {
            newReportItem.QARemaining += workRemaining;

            if ((taskTitle.indexOf("pre-merge") > -1) || (taskTitle.indexOf("pre merge") > -1)) preMergePending = true;
            if ((taskTitle.indexOf("post-merge") > -1) || (taskTitle.indexOf("post merge") > -1)) postMergePending = true;
        }
    }

    var adjustableStates = ["In Progress", "Done"];

    if (adjustableStates.indexOf(newReportItem.State) > -1 && newReportItem.DevRemaining === 0) {
        if (preMergePending) newReportItem.State = "Pre-Merge Testing";
        else if (poReviewPending) newReportItem.State = "PO Review";
        else if (mergePending) newReportItem.State = "Awaiting Merge";
        else if (postMergePending) newReportItem.State = "Post-Merge Testing";
    }

    reportItems.push(newReportItem);
}

function WaitToDisplayResults() {
    if (apiStarted > apiCompleted) {
        setTimeout(function () { WaitToDisplayResults() }, 1000);
        DisplayProgress();
    }
    else
        DisplayResults();
}

function DisplayProgress() {
    $("div.progress").remove();

    var markUp = "<div class='progress'>";
    markUp += "Processing: " + apiCompleted + " of " + apiStarted + " items completed.";
    markUp += "</div>";

    $("body").append(markUp);
}

function DisplayResults() {
    $("div.progress").remove();

    reportItems.sort(CompareIssueIds);

    var markUp = "<table class='datatable'>";
    markUp += "<tr>";
    markUp += "<th class='numeric-cell'>Id</th>";
    markUp += "<th class='text-cell'>Type</th>";
    markUp += "<th class='text-cell'>Title</th>";
    markUp += "<th class='text-cell'>State</th>";
    markUp += "<th class='numeric-cell'>Dev Remaining</th>";
    markUp += "<th class='numeric-cell'>QA Remaining</th>";
    markUp += "<th class='text-cell'>Owners</th>";
    markUp += "</tr>";

    for (var reportIndex in reportItems) {
        var reportItem = reportItems[reportIndex];

        var owners = "";
        for (var ownerIndex in reportItem.DevContributors) {
            if (ownerIndex > 0)
                owners += ", ";
            owners += reportItem.DevContributors[ownerIndex];
        }

        if (reportItem.State === "Complete" || reportItem.State === "Closed" || reportItem.State === "Released")
            markUp += "<tr style='background-color: green; color: white;'>";
        else
            markUp += "<tr>";

        markUp += "<td class='numeric-cell'><a href='" + settings.YouTrackRootUrl + "/issue/" + reportItem.Id + "' target='_blank'>" + reportItem.Id + "</a></td>";
        markUp += "<td class='text-cell'>" + reportItem.Type + "</td>";
        markUp += "<td class='text-cell'>" + htmlEncode(reportItem.Title) + "</td>";
        markUp += "<td class='text-cell'>" + reportItem.State + "</td>";
        markUp += "<td class='numeric-cell'>" + reportItem.DevRemaining + "</td>";
        markUp += "<td class='numeric-cell'>" + reportItem.QARemaining + "</td>";
        markUp += "<td class='text-cell'>" + htmlEncode(owners) + "</td>";
        markUp += "</tr>";
    }

    markUp += "</table>";

    $("body").append(markUp);

    ShowRowColoursForBreakdowns();
}

function CompareIssueIds(a, b) {
    var issueIdA = parseInt(a.Id.replace("CAS-", ""));
    var issueIdB = parseInt(b.Id.replace("CAS-", ""));

    if (issueIdA > issueIdB)
        return 1;
    else if (issueIdA < issueIdB)
        return -1;
    else
        return 0;
}