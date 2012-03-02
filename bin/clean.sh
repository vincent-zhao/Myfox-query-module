#!/bin/sh

LOG_PATH='../log'

find $LOG_PATH -mtime +6 -type f -exec rm -f {} \;
