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

            if (IsAllowedToOperate())
                GetDefectTrackingData();
            else
                window.location.replace(settings.RedirectOnCompleteUrl);
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
            ShowAllIsDone();
        },
        error: function (jsonData) {
            ShowAllIsDone();
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

function DisplayError() {
    attemptNumber = attemptNumber + 1;

    var errorMessage = "Something went wrong, attempt number " + attemptNumber + " will commence shortly";

    DisplayMessage(errorMessage);

    setTimeout(function () { GetDefectTrackingData(); }, 60000);
}

function IsAllowedToOperate() {
    var now = new Date();
    var dayOfWeek = now.getDay();
    var hourOfDay = now.getHours();

    if ((dayOfWeek === 0) || (dayOfWeek === 6) || (hourOfDay < 7) || (hourOfDay > 17))
        return false;

    return true;
}

function ShowAllIsDone() {
    DisplayMessage("All tasks have been completed.");

    var redirectUrl = settings.RedirectOnCompleteUrl;

    if (redirectUrl !== undefined && redirectUrl !== "")
        setTimeout(function () { window.location.replace(redirectUrl); }, 10000);
}