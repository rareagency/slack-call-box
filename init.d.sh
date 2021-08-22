#!/bin/bash
#
# nodejs - Startup script for node.js server
# /etc/init.d/app1
#
# chkconfig: 35 99 99
# description: Node.js node /home/pi/apps/slack-call-box/index.js

rootdir="/home/pi/apps/slack-call-box"
server="$rootdir/index.js"
logfile="/var/log/apps/slack-call-box.log"

user="pi"
nodejs=${NODEJS-/usr/local/bin/node}

script="$(basename $0)"
lockfile="/var/lock/subsys/$script"

ulimit -n 12000
RETVAL=0

su "$user" -c "touch $logfile"

echo_success() {
    [ "$BOOTUP" = "color" ] && $MOVE_TO_COL
    echo -n "["
    [ "$BOOTUP" = "color" ] && $SETCOLOR_SUCCESS
    echo -n $"  OK  "
    [ "$BOOTUP" = "color" ] && $SETCOLOR_NORMAL
    echo -n "]"
    echo -ne "\r"
    return 0
}

echo_failure() {
    [ "$BOOTUP" = "color" ] && $MOVE_TO_COL
    echo -n "["
    [ "$BOOTUP" = "color" ] && $SETCOLOR_FAILURE
    echo -n $"FAILED"
    [ "$BOOTUP" = "color" ] && $SETCOLOR_NORMAL
    echo -n "]"
    echo -ne "\r"
    return 1
}

do_start()
{
    if [ ! -f "$lockfile" ] ; then
        date +"%Y-%m-%d %T Starting $server" >> $logfile
        echo -n $"Starting $server: "
        su "$user" -c "cd $rootdir && git pull"
        su "$user" -c "cd $rootdir && npm install"
        su "$user" -c "cd $rootdir && NODE_ENV=production $nodejs $rootdir/index.js 'production' >> $logfile &" && echo_success || echo_failure
        RETVAL=$?
        echo
        [ $RETVAL -eq 0 ] && touch "$lockfile"
    else
        echo "$server is locked."
        RETVAL=1
    fi
}

do_stop()
{
    date +"%Y-%m-%d %T Stopping $server" >> $logfile
    echo -n $"Stopping $server: "
    pid=`ps -aefw | grep "$nodejs $server" | grep -v " grep " | awk '{print $2}'`
    kill -9 $pid > /dev/null 2>&1 && echo_success || echo_failure
    RETVAL=$?
    echo
    [ $RETVAL -eq 0 ] && rm -f "$lockfile"

    if [ "$pid" = "" -a -f "$lockfile" ]; then
        rm -f "$lockfile"
        echo "Removed lockfile ( $lockfile )"
    fi
}

do_status()
{
   pid=`ps -aefw | grep "$nodejs $server" | grep -v " grep " | awk '{print $2}'`
   if [ "$pid" != "" ]; then
     echo "$nodejs $server (pid $pid) is running..."
   else
     echo "$nodejs $server is stopped"
   fi
}

case "$1" in
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    status)
        do_status
        ;;
    restart)
        do_stop
        do_start
        RETVAL=$?
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart}"
        RETVAL=1
esac

exit $RETVAL