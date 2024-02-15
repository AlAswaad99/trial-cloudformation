
#!/bin/bash -x
sudo apt update -y
sudo apt install -y redis-server
sudo sed -i "s/bind 127.0.0.1 ::1/bind 0.0.0.0/" /etc/redis/redis.conf
sudo sed -i "s/port 6379/port 63791/" /etc/redis/redis.conf 
sudo cat /etc/redis/redis.conf | grep -E "^bind|^protected-mode|^port"
redis-cli info server
sudo systemctl start redis-server
sudo systemctl enable redis-server
redis-cli ping
echo "Redis installation and configuration completed."
cd ~
curl -sL https://deb.nodesource.com/setup_lts.x -o nodesource_setup.sh          
sudo bash nodesource_setup.sh
sudo apt install -y nodejs git

sudo npm install -g pm2
cd /home/ubuntu
mkdir app && cd app
git clone https://github.com/AlAswaad99/trial-cloudformation.git .
npm install
pm2 start server.js
