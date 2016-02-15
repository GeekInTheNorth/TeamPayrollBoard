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