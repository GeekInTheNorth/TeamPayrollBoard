TeamPayrollBoard
================

An Information Radiator for my development team "Team Payroll".  We use Youtrack as a Kanban board and for tracking pieced of work on and off the board which is then in connected to Team City and a private Git server.

While Youtrack is great for getting an overall feel for where we are, I wanted an information radiator (screen) that would tell me a few key pieces of information that were really easy to read:

* Which patches have made progress recently
* How many patches are in each state
* How many we have remaining to sign off

CONFIGURATION
=============

In order to use this web application you need to configure Youtrack to allow Guest access by following these steps:

* Log into Youtrack as an administrator
* Go to Administration
* Click on the Settings link
* Scroll down to Users and tick Guest Account and then click save
* Optionally click Manage Guest Permissions to ensure the guest account can see the data you want to report on

Inside the Data folder for this website is a file named "Configuration.json.template".  Rename this file to remove the ".template" extension.

Edit the Configuration.json file and add an entry into the States collection for each Youtrack state you wish to display.  There is no limit on the number of states that can be displayed, however the collection in the json file should be in the same order as you wish to see them on screen.  Here is an example from my configuration file:

```javascript
{
	"DisplayName": "Func. Testing - Done",
	"Name": "Functional Testing - Done"
}
```

Edit the Configuration.json file and add an entry into Screens for set of information you wish to display.  There is no limit to the number of screens that can be displayed.  Here is an example from my configuration file:

```javascript
{
	"DisplayName": "Team Payroll - Regression",
	"DataType": "StateCounts",
	"Url": "http://youtrack:9111/rest/issue/byproject/PY?filter=project%3A+Payroll+Payroll+Board%3A+5.3+State%3A+%7BDesigning%7D+..+%7BComplete%7D+Regression%3A+Yes+order+by%3A+updated+desc&max=100"
}
```

DONE
====

last Updated 21/10/2014

* Display an error message when failing to connect to Youtrack
* Show Summary Titles based on configured data
* Removed place-holders for Days In Sprint numbers since they were not operable yet
* Displayed Item Counts and Latest Items separately on a rotating cycle
* Retitle to something less tied to my Dev. Team.
* Clean up classes and styles
* Implement a How to Use
* Template the Configuration.json
* Make the totals count a different colour to the other counts
* Removed the need to configure the number of screens to cycle through

TODO
====

* Allow the Refresh time to be configured
* Try and remove tables from count screens