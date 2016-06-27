/*
 * Copyright (c) Peter Jensen, SatoshiLabs
 *
 * Licensed under Microsoft Reference Source License (Ms-RSL)
 * see LICENSE.md file for details
 */

'use strict';

const receiverRelativePath = '/html/chrome_oauth_receiver.html',
    APIKEY = 's340kh3l0vla1nv';

class DropboxMgmt {

    constructor(bgStore) {
        this.bgStore = bgStore;
        this.client = new Dropbox.Client({key: APIKEY});
        this.client.onError.addListener((error) => {
            this.handleDropboxError(error);
        });
    }

    isAuth() {
        return this.client.isAuthenticated();
    }

    handleDropboxError(error) {
        console.warn('Dropbox error:', error);
        switch (error.status) {
            case Dropbox.ApiError.INVALID_TOKEN:
                console.warn('User token expired ', error.status);
                this.bgStore.emit('sendMessage', 'errorMsg', {code: 'DB_INVALID_TOKEN', msg: error.status});
                break;

            case Dropbox.ApiError.NOT_FOUND:
                console.warn('File or dir not found ', error.status);
                this.bgStore.emit('initStorageFile');
                break;

            case Dropbox.ApiError.OVER_QUOTA:
                console.warn('Dropbox quota overreached ', error.status);
                this.bgStore.emit('sendMessage', 'errorMsg', {code: 'DB_OVER_QUOTA', msg: error.status});
                break;

            case Dropbox.ApiError.RATE_LIMITED:
                console.warn('Too many API calls ', error.status);
                this.bgStore.emit('sendMessage', 'errorMsg', {code: 'DB_RATE_LIMITED', msg: error.status});
                break;

            case Dropbox.ApiError.NETWORK_ERROR:
                console.warn('Network error, check connection ', error.status);
                this.bgStore.emit('sendMessage', 'errorMsg', {code: 'DB_NETWORK_ERROR', msg: error.status});
                break;

            case Dropbox.ApiError.INVALID_PARAM:
            case Dropbox.ApiError.OAUTH_ERROR:
            case Dropbox.ApiError.INVALID_METHOD:
                console.warn('Network error, check connection ', error.status);
                this.bgStore.emit('sendMessage', 'errorMsg', {code: 'DB_NETWORK_ERROR', msg: error.status});
                break;
        }

        if (error.code === 'access_denied') {
            this.bgStore.emit('disconnectDropbox');
            this.bgStore.emit('sendMessage', 'errorMsg', {code: 'DB_ACCESS_DENIED', msg: error.description});
            this.client.reset();
        }
    }

    connect() {
        this.client.authDriver(new Dropbox.AuthDriver.ChromeExtension({receiverPath: receiverRelativePath}));
        this.client.authenticate((error, data) => {
            if (!error) {
                if (this.isAuth()) {
                    this.getDropboxUsername();
                }
            } else {
                this.client.reset();
                this.bgStore.emit('sendMessage', 'disconnected');
            }
        });
    }

    getDropboxUsername() {
        this.client.getAccountInfo((error, accountInfo) => {
            if (!error) {
                this.bgStore.setUsername(accountInfo.name, 'DROPBOX');
            }
        });
    }

    signOut() {
        this.client.signOut((error, accountInfo) => {
            if (!error) {
                this.bgStore.emit('sendMessage', 'disconnected');
                this.bgStore.disconnect();
            } else {
                this.client.reset();
                this.bgStore.emit('sendMessage', 'disconnected');
            }
        });
    }

    loadFile() {
        if (!this.bgStore.fileName) {
            try {
                this.bgStore.setFileName();
            } catch (ex) {
                console.log('Crypto failed: ', ex);
                //TODO soon please
            }
        }
        this.client.readFile(this.bgStore.fileName, {arrayBuffer: true}, (error, data) => {
            if (!error) {
                this.bgStore.setData(data);
            }
        });
    }

    saveFile(data) {
        this.client.writeFile(this.bgStore.fileName, data, (error, stat) => {
            if (!error) {
                this.loadFile();
            }
        });
    }

    createNewDataFile(data) {
        this.saveFile(data);
    }
}

module.exports = DropboxMgmt;
