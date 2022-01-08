#!/usr/bin/env bash

# =======================================================================
#  NOTE: This script does not automatically set up things for you.
#        It was written more as a reference, with the steps to take
#        in order to setup MongoDB and pm2 on Ubuntu
#        Read through it, and check the reference URLs for more info
# =======================================================================

# --------------------------------
# Install & Setup MongoDB 5.0.x
# --------------------------------

# Import the public key used by the package management system
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -

# Create the list file /etc/apt/sources.list.d/mongodb-org-5.0.list
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list

# Reload local package database
sudo apt-get update

# Install the latest stable version
sudo apt-get install -y mongodb-org

# Start MongoDB server
sudo systemctl start mongod

# Verify that MongoDB has started successfully
sudo systemctl status mongod

# ensure that MongoDB will start following a system reboot
sudo systemctl enable mongod

# --------------------------------
# Secure MongoDB
# --------------------------------

# See https://www.digitalocean.com/community/tutorials/how-to-secure-mongodb-on-ubuntu-20-04

# --------------------------------
# Install and Setup PM2
# --------------------------------

# NOTE: pm2 doesn't seem to work nicely with volta, or at least I faced some challenges using it with volta
#       so I had to uninstall volta (https://docs.volta.sh/advanced/uninstall)

# see https://pm2.keymetrics.io/docs/

sudo npm install pm2@latest -g

# First, generate a Startup Script:
pm2 startup

# then copy/paste the displayed command onto the terminal:
# see <https://pm2.keymetrics.io/docs/usage/startup/>

# ---------------------------------
# MongoDB setup for a specific app
# ---------------------------------

# first, create a Database and User, see <https://www.shellhacks.com/mongodb-create-database-and-user-mongo-shell/>

# To create a `new_database`` in MongoDB, firstly it needs to select this database to use:
# use new_database

# A new database in MongoDB won’t be created until you insert at lest one document into it:
# > db.new_collection.insert({ some_key: "some_value" })
# db.new_collection.insert({ app_identifier: "appID" })

# To create a new_user for `new_database` with readWrite permissions in MongoDB, run:
# db.createUser(
#   {
#     user: "new_database_user",
#     pwd: passwordPrompt(),
#     roles: [ { role: "readWrite", db: "new_database" } ]
#   }
# )

# the databse connection string format (see https://docs.mongodb.com/manual/reference/connection-string/):
# mongodb://[username:password@]host1[:port1][,...hostN[:portN]][/[defaultauthdb][?options]]

