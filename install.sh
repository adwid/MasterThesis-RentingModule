#!/bin/bash

cd "$(dirname "$0")" || exit

cd Inbox && npm i
cd ..
cd Outbox && npm i
cd ..
cd Querier && npm i
cd ..
cd Test && npm i
cd ..
