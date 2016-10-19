var settings = undefined;
var workRemainingPosts = 0;
var workRemainingPostsCompleted = 0;
var attemptNumber = 1;

$(document).ready(function () {
    LoadSettings();
});

function LoadSettings() {
    DisplayMessage("Loading configuration...");

    $.ajax({
        type: "Get",
        url: "./Data/DevStatsApiPostParameters.json",
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            settings = jsonData;
            GetDefectTrackingData();
        }
    });
}

function GetDefectTrackingData() {
    DisplayMessage("Polling You Track for defect tracking data");

    var dataurl = "Project: {" + settings.DefectTracking.YouTrackProject + "} Type: {" + settings.DefectTracking.ExternalType + "}, {" + settings.DefectTracking.InternalType + "}, {" + settings.DefectTracking.ReworkType + "}";

    if (settings.DefectTracking.UpdateRange === "Month") {
        dataurl += " updated: {Last month} .. {This month}";
    } else if (settings.DefectTracking.UpdateRange === "Week") {
        dataurl += " updated: {Last week} .. {This week}";
    }

    dataurl += " order by: {issue id} desc";

    dataurl = settings.YouTrackRootUrl + "/rest/issue?filter=" + encodeURI(dataurl) + "&max=500";

    $.ajax({
        url: dataurl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            PostDefectTrackingData(jsonData);
        },
        error: function () {
            DisplayError();
        }
    });
}

function PostDefectTrackingData(youTrackData) {
    DisplayMessage("Analysing You Track Data...");

    var dataPackage = [];

    for (var taskIndex in youTrackData.issue) {
        var task = youTrackData.issue[taskIndex];

        var defectId = task.id;
        var module = "";
        var defectType = "";
        var created = null;
        var closed = null;

        for (var fieldIndex in task.field) {
            var field = task.field[fieldIndex];

            if (field.name === "Type") defectType = ConvertType(field.value[0]);
            if (field.name === "created") created = ConvertYouTrackDateToString(field.value);
            if (field.name === "resolved") closed = ConvertYouTrackDateToString(field.value);
            if (field.name === "Subsystem") module = field.value[0];
        }

        if (created === null) continue;

        var issue = new Object();
        issue.DefectId = defectId;
        issue.Module = module;
        issue.Type = defectType;
        issue.Created = created;
        if (closed !== null)
            issue.Closed = closed;

        dataPackage.push(issue);
    }

    DisplayMessage("Posting defect tracking data to DevStats...");

    var postUrl = settings.DevStatsApiRoot + "/defecttracking";

    $.ajax({
        type: "POST",
        url: postUrl,
        data: { '': dataPackage },
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            GetWorkRemainingData();
        },
        error: function (jsonData) {
            GetWorkRemainingData();
        }
    });
}

function ConvertYouTrackDateToString(milliseconds) {
    var thisDate = new Date(0);
    thisDate.setMilliseconds(milliseconds);

    var year = thisDate.getFullYear();
    var month = thisDate.getMonth() + 1;
    var day = thisDate.getDate();
    var monthPrefix = month < 10 ? "0" : "";
    var dayPrefix = day < 10 ? "0" : "";

    return "" + year + "-" + monthPrefix + month + "-" + dayPrefix + day + "T00:00:00.000Z";
}

function ConvertType(youTrackType) {
    if (youTrackType === settings.DefectTracking.ExternalType)
        return "External";
    else if (youTrackType === settings.DefectTracking.InternalType)
        return "Internal";
    else if (youTrackType === settings.DefectTracking.ReworkType)
        return "Rework";
    else
        return "Unknown";
}

function DisplayMessage(messageText) {
    $("div.message-banner").empty();
    $("div.message-banner").append(messageText);
}

function GetWorkRemainingData() {
    DisplayMessage("Polling YouTrack for work remaining data");

    var dataUrl = "Project: {" + settings.SprintWorkRemaining.YouTrackProject + "}";

    dataUrl += " Sprint: ";
    for (var sprintIndex in settings.SprintWorkRemaining.Sprints) {
        if (sprintIndex > 0)
            dataUrl += ", ";
        dataUrl += "{" + settings.SprintWorkRemaining.Sprints[sprintIndex] + "}";
    }

    dataUrl += " State: ";
    for (var stateIndex in settings.SprintWorkRemaining.WorkRemainingStates) {
        if (stateIndex > 0)
            dataUrl += ", ";
        dataUrl += "{" + settings.SprintWorkRemaining.WorkRemainingStates[stateIndex] + "}";
    }

    dataUrl += " Type: ";
    for (var typeIndex in settings.SprintWorkRemaining.TaskTypes) {
        if (typeIndex > 0)
            dataUrl += ", ";
        dataUrl += "{" + settings.SprintWorkRemaining.TaskTypes[typeIndex] + "}";
    }

    dataUrl += " order by: {issue id} desc";

    dataUrl = settings.YouTrackRootUrl + "/rest/issue?filter=" + encodeURI(dataUrl) + "&max=500";

    $.ajax({
        url: dataUrl,
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function (jsonData) {
            AnalyzeWorkRemainingData(jsonData);
        },
        error: function () {
            DisplayError();
        }
    });
}

function AnalyzeWorkRemainingData(youTrackData) {
    DisplayMessage("Analyzing Work Remaining Data...");
    var sprintSummaries = GetSprintSummariesWithZeros();

    for (var taskIndex in youTrackData.issue) {
        var task = youTrackData.issue[taskIndex];
        var type = "Unknown";
        var state = "Unknown";
        var sprint = "Unknown";
        var estimate = 0;
        var workRemaining = 0;

        for (var fieldIndex in task.field) {
            var field = task.field[fieldIndex];

            if (field.name === "State") state = field.value[0];
            if (field.name === "Estimate") estimate = parseInt(field.value[0]);
            if (field.name === "WorkRemaining") workRemaining = parseInt(field.value[0]);
            if (field.name === "Sprint") sprint = field.value[0];
        }

        if (state !== "In Progress" && estimate >= 0 && workRemaining === 0)
            workRemaining = estimate;

        for (var sprintSummaryIndex in sprintSummaries) {
            var sprintSummary = sprintSummaries[sprintSummaryIndex];
            if (sprintSummary.Name === sprint)
            {
                sprintSummary.WorkRemaining += workRemaining
                break;
            }
        }
    }

    PostWorkRemaining(sprintSummaries);
}

function GetSprintSummariesWithZeros() {
    var sprintSummaries = [];

    for (var sprintIndex in settings.SprintWorkRemaining.Sprints) {
        var sprintSummary = new Object();
        sprintSummary.Name = settings.SprintWorkRemaining.Sprints[sprintIndex];
        sprintSummary.WorkRemaining = 0;
        sprintSummaries.push(sprintSummary);
    }

    return sprintSummaries;
}

function PostWorkRemaining(sprintSummaries) {
    DisplayMessage("Posting Work Remaining Data to DevStats...");
    workRemainingPosts = sprintSummaries.length;
    workRemainingPostsCompleted = 0;

    for (var sprintSummaryIndex in sprintSummaries) {
        var sprintSummary = sprintSummaries[sprintSummaryIndex];
        
        PostWorkRemainingForSprint(sprintSummary.Name, sprintSummary.WorkRemaining);
    }

    WaitToFinish();
}

function PostWorkRemainingForSprint(sprintName, workRemaining) {
    var today = new Date();
    var year = today.getFullYear();
    var month = today.getMonth() + 1;
    var day = today.getDate();

    if (month < 10) month = "0" + month;
    if (day < 10) day = "0" + day;

    var dataPackage = '{"Sprint":"' + sprintName + '","Date":"' + year + '-' + month + '-' + day + 'T00:00:00.000Z","WorkRemaining":' + workRemaining + '}';

    var postUrl = settings.DevStatsApiRoot + "/burndown";

    $.ajax({
        type: "POST",
        url: postUrl,
        data: dataPackage,
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (jsonData) {
            workRemainingPostsCompleted++;
        },
        error: function (jsonData) {
            workRemainingPostsCompleted++;
        }
    });
}

function WaitToFinish() {
    if (workRemainingPosts === workRemainingPostsCompleted){
        DisplayMessage("All tasks have been completed.");

        var redirectUrl = settings.RedirectOnCompleteUrl;

        if (redirectUrl !== undefined && redirectUrl !== "")
            setTimeout(function () { window.location.replace(redirectUrl); }, 10000);
    }
    else
        setTimeout(function () { WaitToFinish() }, 1000);
}

function DisplayError() {
    attemptNumber = attemptNumber + 1;

    var errorMessage = "Something went wrong, attempt number " + attemptNumber + " will commence shortly";

    DisplayMessage(errorMessage);

    setTimeout(function () { GetDefectTrackingData(); }, 60000);
}