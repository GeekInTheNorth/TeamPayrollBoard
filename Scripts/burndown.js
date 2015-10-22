$(document).ready(function () {
    SetRefresh();
    GetYouTrackData();
});

function DrawChart(idealProgress, workingProgress, doneProgress)
{
	var today = GetToday();
	var dates = ["28/09/2015","29/09/2015","30/09/2015","01/10/2015","02/10/2015","05/10/2015","06/10/2015","07/10/2015","08/10/2015","09/10/2015","12/10/2015","13/10/2015","14/10/2015","15/10/2015","16/10/2015","19/10/2015","20/10/2015","21/10/2015","22/10/2015"];
	var fromLoc = 0;
	var toLoc = 0.5;
	var foundDatePosition = false;
	
	for (index = 0; index < dates.length; index++)
	{
		if (dates[index] == today)
		{
			fromLoc = index - 0.5;
			toLoc = index + 0.5;
			foundDatePosition = true;
		}
	}
	
	if (!foundDatePosition)
	{
		fromLoc = 0;
		toLoc = 0;
	}
	
	$('#container').highcharts({
		title: {
            text: 'Payroll Burndown - 28th September - 23rd October 2015',
            x: -20, //center,
			style: {
                fontWeight: 'bold',
				fontSize: '30px'
            },
        },
        xAxis: {
            categories: dates,
			plotBands: {
				color: '#fea', // Color value
				from: fromLoc, // Start of the plot band
				to: toLoc // End of the plot band
			  }
        },
        yAxis: {
            title: {
                text: 'Estimation'
            },
            min : 0,
            plotLines: [{
                value: 0,
                width: 1,
                color: '#808080'
            }]
        },
        series: [{
            name: 'Ideal',
            data: idealProgress
        }, {
            name: 'Not Started',
            data: workingProgress
        }, {
            name: 'Remaining',
            data: doneProgress
        }]
    });
}

function GetYouTrackData()
{
	$.ajax({
        url: "http://youtrack:9111/rest/issue/byproject/CAS?filter=Sprint%3A+%7BPayroll+1%7D+Type%3A+Defect+%2C+Task+%2C+%7BTesting+Task%7D+%2C+%7BProduct+Owner+Review%7D+%2C+Merge+order+by%3A+updated+desc&max=200",
        dataType: "json",
        headers: {
            accept: 'application/json'
        },
        success: function(jsonData) {
            AnalyseYouTrackData(jsonData);
        }
    });
}

function AnalyseYouTrackData(jsonData)
{
	var totalEstimate = 0;
	var doneItems =       [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	var inProgressItems = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	var doneProgress =    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	var idealProgress =   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	var workingProgress = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	
	for (var taskLocation in jsonData)
	{
		var task = jsonData[taskLocation];
		var isDone = false;
		var isWorking = false;
		var estimate = 0;
		var doneDate = undefined;
		var inProgressDate = undefined;
		var taskId = task.id;
		var type = "";
			
		for (var fieldLocation in task.field)
		{
			var field = task.field[fieldLocation];

			if (field.name == "Type")
			{
				type = field.value[0];
			}
			
			if (field.name == "Estimate")
			{
				estimate = parseInt(field.value[0], 0);
			}
			
			if (field.name == "DoneDate")
			{
				doneDate = ConvertYouTrackDate(field.value[0]);
				isDone = true;
			}
			
			if (field.name == "InProgressDate")
			{
				inProgressDate = ConvertYouTrackDate(field.value[0]);
				isWorking = true;
			}
		}

		if (isDone)
		    doneDate = ShiftDateFromWeekendToWeekDay(doneDate);
		if (isWorking)
		    inProgressDate = ShiftDateFromWeekendToWeekDay(inProgressDate);
		if (isDone && IsDateLessThan(doneDate, "28/09/2015"))
		    continue;
		if (isWorking && IsDateLessThan(inProgressDate, "28/09/2015"))
		    inProgressDate = "28/09/2015";

		totalEstimate += estimate;
		if (isDone && (doneDate != undefined))
		{
			if (doneDate == "28/09/2015") doneItems[0] += estimate;
			if (doneDate == "29/09/2015") doneItems[1] += estimate;
			if (doneDate == "30/09/2015") doneItems[2] += estimate;
			if (doneDate == "01/10/2015") doneItems[3] += estimate;
			if (doneDate == "02/10/2015") doneItems[4] += estimate;
			if (doneDate == "05/10/2015") doneItems[5] += estimate;
			if (doneDate == "06/10/2015") doneItems[6] += estimate;
			if (doneDate == "07/10/2015") doneItems[7] += estimate;
			if (doneDate == "08/10/2015") doneItems[8] += estimate;
			if (doneDate == "09/10/2015") doneItems[9] += estimate;
			if (doneDate == "12/10/2015") doneItems[10] += estimate;
			if (doneDate == "13/10/2015") doneItems[11] += estimate;
			if (doneDate == "14/10/2015") doneItems[12] += estimate;
			if (doneDate == "15/10/2015") doneItems[13] += estimate;
			if (doneDate == "16/10/2015") doneItems[14] += estimate;
			if (doneDate == "19/10/2015") doneItems[15] += estimate;
			if (doneDate == "20/10/2015") doneItems[16] += estimate;
			if (doneDate == "21/10/2015") doneItems[17] += estimate;
			if (doneDate == "22/10/2015") doneItems[18] += estimate;
		}
		
		if (isWorking && (inProgressDate != undefined))
		{
			if (inProgressDate == "28/09/2015") inProgressItems[0] += estimate;
			if (inProgressDate == "29/09/2015") inProgressItems[1] += estimate;
			if (inProgressDate == "30/09/2015") inProgressItems[2] += estimate;
			if (inProgressDate == "01/10/2015") inProgressItems[3] += estimate;
			if (inProgressDate == "02/10/2015") inProgressItems[4] += estimate;
			if (inProgressDate == "05/10/2015") inProgressItems[5] += estimate;
			if (inProgressDate == "06/10/2015") inProgressItems[6] += estimate;
			if (inProgressDate == "07/10/2015") inProgressItems[7] += estimate;
			if (inProgressDate == "08/10/2015") inProgressItems[8] += estimate;
			if (inProgressDate == "09/10/2015") inProgressItems[9] += estimate;
			if (inProgressDate == "12/10/2015") inProgressItems[10] += estimate;
			if (inProgressDate == "13/10/2015") inProgressItems[11] += estimate;
			if (inProgressDate == "14/10/2015") inProgressItems[12] += estimate;
			if (inProgressDate == "15/10/2015") inProgressItems[13] += estimate;
			if (inProgressDate == "16/10/2015") inProgressItems[14] += estimate;
			if (inProgressDate == "19/10/2015") inProgressItems[15] += estimate;
			if (inProgressDate == "20/10/2015") inProgressItems[16] += estimate;
			if (inProgressDate == "21/10/2015") inProgressItems[17] += estimate;
			if (inProgressDate == "22/10/2015") inProgressItems[18] += estimate;
		}
	}
	
	for (index = 0; index < doneProgress.length; index++)
	{
		idealProgress[index] = totalEstimate - (index * (totalEstimate / 18));
		doneProgress[index] = totalEstimate;
		workingProgress[index] = totalEstimate;
		for (doneIndex = 0; doneIndex <= index; doneIndex++)
		{
			doneProgress[index] -= doneItems[doneIndex];
			workingProgress[index] -= inProgressItems[doneIndex];
		}
	}
	
	DrawChart(idealProgress, workingProgress, doneProgress);
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

function GetToday()
{
	var today = new Date();
	var dd = today.getDate();
	var mm = today.getMonth()+1; //January is 0!
	var yyyy = today.getFullYear();
	
	if(dd<10) {
		dd='0'+dd
	} 
	
	if(mm<10) {
		mm='0'+mm
	} 
	
	today = dd+'/'+mm+'/'+yyyy;
	
	return today;
}

function IsDateLessThan(toCheck, toCheckAgainst)
{
	var dateToCheck = new Date(toCheck.substr(6, 4) + "-" + toCheck.substr(3, 2) + "-" + toCheck.substr(0, 2));
	var dateToCheckAgainst = new Date(toCheckAgainst.substr(6, 4) + "-" + toCheckAgainst.substr(3, 2) + "-" + toCheckAgainst.substr(0, 2));
	
	return dateToCheck < dateToCheckAgainst;
}

function getURLParameter(name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [, ""])[1].replace(/\+/g, '%20')) || null
}

function ShiftDateFromWeekendToWeekDay(dateToShift)
{
    if (dateToShift == null || dateToShift == "undefined") return dateToShift;

    var dateString = dateToShift.substr(6, 4) + "-" + dateToShift.substr(3, 2) + "-" + dateToShift.substr(0, 2);
    var date = new Date(dateString);

    if (date.getDay() == 0) date = date + 1;
    if (date.getDay() == 6) date = date + 2;

    return DateToString(date);
}

function SetRefresh() {
    var navigationParameter = getURLParameter("DoNavigation");
    if (navigationParameter != null && navigationParameter === "Yes")
        setTimeout(function () { window.location.replace("YouTrackSummary.html?DisplayIndex=2"); }, 60000);
    else
        setTimeout(function () { window.location.reload(); }, 180000);
}

function DateToString(theDate) {
    var displayString = "";

    if (theDate.getDate() < 10)
        displayString = "0" + theDate.getDate() + "/";
    else
        displayString = theDate.getDate() + "/";

    if ((theDate.getMonth() + 1) < 10)
        displayString = displayString + "0" + (theDate.getMonth() + 1) + "/" + theDate.getFullYear();
    else
        displayString = displayString + (theDate.getMonth() + 1) + "/" + theDate.getFullYear();

    return displayString;
}