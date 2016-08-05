function GetStringDateAsMonthText(dateString) {
    if (dateString === undefined) return "n/a";

    var yearString = dateString.substr(6, 4);
    var monthString = dateString.substr(3, 2);
    var monthInt = parseInt(monthString);
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return months[monthInt - 1] + " " + yearString;
}

function GetMonthString(theDate) {
    if (theDate === undefined) return "n/a";

    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var theMonth = theDate.getMonth();
    var theYear = theDate.getFullYear();

    return months[theMonth] + " " + theYear;
}

function ConvertYouTrackDate(milliseconds) {
    var thisDate = new Date(0);
    thisDate.setMilliseconds(milliseconds);

    // YouTrack stores seconds, we need to convert this from a UTC datetime to a local datetime
    // Previously we handled this by adding an hour which worked for our own location
    var dateString = thisDate.toString();
    if (dateString.indexOf("GMT") >= 0) {
        dateString = dateString.substring(0, dateString.indexOf("GMT"));
        dateString.trim();
        dateString += "UTC";

        thisDate = new Date(dateString);
    }

    return DateToString(thisDate);
}

function DateToString(theDate) {
    var displayString = "";
    var dateToConvert = new Date(theDate);

    if (dateToConvert.getDate() < 10)
        displayString = "0" + dateToConvert.getDate() + "/";
    else
        displayString = dateToConvert.getDate() + "/";

    if ((dateToConvert.getMonth() + 1) < 10)
        displayString = displayString + "0" + (dateToConvert.getMonth() + 1) + "/" + dateToConvert.getFullYear();
    else
        displayString = displayString + (dateToConvert.getMonth() + 1) + "/" + dateToConvert.getFullYear();

    return displayString;
}

function getURLParameter(name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [, ""])[1].replace(/\+/g, '%20')) || null
}

function RefreshData() {
    location.reload();
}

function ShowRowColoursForBreakdowns() {
    $("table.datatable tr:even").addClass("alternate-row");
    $("table.datatable tr:odd").addClass("normal-row");
}

function ConvertYouTrackDataToObjects(youTrackData, objectArray, idArray) {
    ConvertYouTrackDataToObjects(youTrackData, objectArray, idArray, undefined);
}

function ConvertYouTrackDataToObjects(youTrackData, objectArray, idArray, teamName) {
    for (var taskIndex in youTrackData.issue) {
        var task = youTrackData.issue[taskIndex];
        var hasRequiresTestingTag = false;
        var hasRequiresPOReview = false;
        var hasRequiresTaskingTag = false;

        if (idArray.indexOf(task.id) > -1) continue;

        idArray.push(task.id);

        var taskObject = new Object();
        taskObject.IssueId = task.id;
        taskObject.Type = undefined;
        taskObject.State = undefined;
        taskObject.Priority = undefined;
        taskObject.Title = undefined;
        taskObject.Subsystem = undefined;
        taskObject.Team = undefined;
        taskObject.Estimate = 0;
        taskObject.ActualTime = 0;
        taskObject.Created = undefined;
        taskObject.Updated = undefined;
        taskObject.UpdatedBy = undefined;
        taskObject.DoneDate = undefined;
        taskObject.InProgressDate = undefined;
        taskObject.Resolved = undefined;
        taskObject.Sprint = undefined;
        taskObject.NeedsPOReview = false;
        taskObject.NeedsTestingTasks = false;
        taskObject.NeedsDevTasks = false;
        taskObject.Developer = undefined;
        taskObject.TShirtSize = undefined;
        taskObject.Project = undefined;

        for (var fieldIndex in task.field) {
            var field = task.field[fieldIndex];

            if (field.name === "Type") taskObject.Type = field.value[0];
            if (field.name === "State") taskObject.State = field.value[0];
            if (field.name === "Priority") taskObject.Priority = field.value[0];
            if (field.name === "summary") taskObject.Title = field.value;
            if (field.name === "projectShortName") taskObject.Project = field.value;
            if (field.name === "Subsystem") taskObject.Subsystem = field.value[0];
            if (field.name === "Estimate") taskObject.Estimate = parseInt(field.value[0]);
            if (field.name === "ActualTime") taskObject.ActualTime = parseInt(field.value[0]);
            if (field.name === "created") taskObject.Created = ConvertYouTrackDate(field.value);
            if (field.name == "updated") taskObject.Updated = ConvertYouTrackDate(field["value"]);
            if (field.name == "updaterFullName") taskObject.UpdatedBy = field["value"];
            if (field.name == "DoneDate") taskObject.DoneDate = ConvertYouTrackDate(field.value[0]);
            if (field.name == "InProgressDate") taskObject.InProgressDate = ConvertYouTrackDate(field.value[0]);
            if (field.name === "resolved") taskObject.Resolved = ConvertYouTrackDate(field.value);
            if (field.name === "Assignee") taskObject.Developer = field.value[0].fullName;
            if (field.name === "T-Shirt Size") taskObject.TShirtSize = field.value[0];

            if (field.name === "Sprint") {
                taskObject.Sprint = field.value[0];
                taskObject.Team = field.value[0].split(" ")[0];
            }
        }

        for (var tagIndex in task.tag) {
            var tagValue = task.tag[tagIndex].value;
            if (tagValue === "Needs Testing Tasks") hasRequiresTestingTag = true;
            if (tagValue === "Req. PO Review") hasRequiresPOReview = true;
            if (tagValue === "Needs Tasking Out") hasRequiresTaskingTag = true;
        }

        if (teamName !== undefined)
            taskObject.Team = teamName;

        taskObject.NeedsPOReview = hasRequiresPOReview;
        taskObject.NeedsTestingTasks = hasRequiresTestingTag || hasRequiresTaskingTag || (taskObject.Estimate <= 1);
        taskObject.NeedsDevTasks = hasRequiresTaskingTag || (taskObject.Estimate <= 1);

        objectArray.push(taskObject);
    }
}

function htmlEncode(value) {
    //create a in-memory div, set it's inner text(which jQuery automatically encodes)
    //then grab the encoded contents back out.  The div never exists on the page.
    return $('<div/>').text(value).html();
}