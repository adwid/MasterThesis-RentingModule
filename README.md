# Master Thesis (module: RENTAL)
##### by Adrien Widart

This module allows the users to advertise their property for rent.
The implementation is based on the DEVI approach.
(See the [main repository](https://github.com/adwid/MasterThesis) to read the thesis and the explanations)

In order for this module to work, it needs few environment variables to be declared.
The microservices will also need to connect with two [MongoDB](https://www.mongodb.com/fr) databases
and this [EventStore](https://eventstore.org/).
See this [file](https://github.com/adwid/MasterThesis/blob/master/.env) for all variables required.

The tests also need a path to a file that contains the environment variables.
