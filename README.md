TeamPayrollBoard
================

An Information Radiator for my development team "Team Payroll".  We use Youtrack as a Kanban board and for tracking pieced of work on and off the board which is then in connected to Team City and a private Git server.

While Youtrack is great for getting an overall feel for where we are, I wanted an information radiator (screen) that would tell me a few key pieces of information that were really easy to read:

1.Which patches have made progress recently
2.How many patches are in each state
3.How many we have remaining to sign off
4.How many working days we have left

TODO
====

Implement the Days until Cut-off counters
Template the Configuration.json
Implement a How to Use
Retitle to something less tied to my Dev. Team.
Allow the Refresh time to be configured

DONE
====
Moved URLs to obtain data from Youtrack out of the javascript to the Configuration.json
Moved State information from the javascript to the Configuration.json