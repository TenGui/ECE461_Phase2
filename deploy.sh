if pm2 pid 461Server > /dev/null 2>&1; then
    pm2 delete 461Server
fi

# Start your application using PM2 with the updated configuration
pm2 start pm2.config.json

# Save the PM2 process list to restart on server reboot
pm2 save