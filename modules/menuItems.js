const { app, BrowserWindow, ipcMain: ipc, Menu, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const Windows = require('./windows');
const Settings = require('./settings');
const log = require('./utils/logger').create('menuItems');
const updateChecker = require('./updateChecker');
const bitherNode = require('./bitherNode.js');
const swarmNode = require('./swarmNode.js');
const ClientBinaryManager = require('./clientBinaryManager');


// Make easier to return values for specific systems
const switchForSystem = function (options) {
    if (process.platform in options) {
        return options[process.platform];
    } else if ('default' in options) {
        return options.default;
    }
    return null;
};


// create menu
// null -> null
const createMenu = function (webviews) {
    webviews = webviews || [];

    const menu = Menu.buildFromTemplate(menuTempl(webviews));
    Menu.setApplicationMenu(menu);
};


const restartNode = function (newType, newNetwork, syncMode, webviews) {
    newNetwork = newNetwork || bitherNode.network;

    log.info('Switch node', newType, newNetwork);

    return bitherNode.restart(newType, newNetwork, syncMode)
        .then(() => {
            Windows.getByType('main').load(global.interfaceAppUrl);

            createMenu(webviews);
            log.info('Node switch successful.');
        })
        .catch((err) => {
            log.error('Error switching node', err);
        });
};


const startMining = (webviews) => {
    bitherNode.send('miner_start', [1])
        .then((ret) => {
            log.info('miner_start', ret.result);

            if (ret.result) {
                global.mining = true;
                createMenu(webviews);
            }
        })
        .catch((err) => {
            log.error('miner_start', err);
        });
};

const stopMining = (webviews) => {
    bitherNode.send('miner_stop', [1])
        .then((ret) => {
            log.info('miner_stop', ret.result);

            if (ret.result) {
                global.mining = false;
                createMenu(webviews);
            }
        })
        .catch((err) => {
            log.error('miner_stop', err);
        });
};


// create a menu template
// null -> obj
let menuTempl = function (webviews) {
    const menu = [];
    webviews = webviews || [];

    // APP
    const fileMenu = [];

    if (process.platform === 'darwin') {
        fileMenu.push(
            {
                label: i18n.t('divan.applicationMenu.app.about', { app: Settings.appName }),
                click() {
                    Windows.createPopup('about', {
                        electronOptions: {
                            width: 420,
                            height: 230,
                            alwaysOnTop: true,
                        },
                    });
                },
            },
            {
                label: i18n.t('divan.applicationMenu.app.checkForUpdates'),
                click() {
                    updateChecker.runVisibly();
                },
            }, {
                label: i18n.t('divan.applicationMenu.app.checkForNodeUpdates'),
                click() {
                    // remove skipVersion
                    fs.writeFileSync(
                        path.join(Settings.userDataPath, 'skippedNodeVersion.json'),
                        '' // write no version
                    );

                    // true = will restart after updating and user consent
                    ClientBinaryManager.init(true);
                },
            }, {
                type: 'separator',
            },
            {
                label: i18n.t('divan.applicationMenu.app.services', { app: Settings.appName }),
                role: 'services',
                submenu: [],
            },
            {
                type: 'separator',
            },
            {
                label: i18n.t('divan.applicationMenu.app.hide', { app: Settings.appName }),
                accelerator: 'Command+H',
                role: 'hide',
            },
            {
                label: i18n.t('divan.applicationMenu.app.hideOthers', { app: Settings.appName }),
                accelerator: 'Command+Alt+H',
                role: 'hideothers',
            },
            {
                label: i18n.t('divan.applicationMenu.app.showAll', { app: Settings.appName }),
                role: 'unhide',
            },
            {
                type: 'separator',
            }
        );
    }
    fileMenu.push(
        { label: i18n.t('divan.applicationMenu.app.quit', { app: Settings.appName }),
            accelerator: 'CommandOrControl+Q',
            click() {
                app.quit();
            },
        });
    menu.push({
        label: i18n.t('divan.applicationMenu.app.label', { app: Settings.appName }),
        submenu: fileMenu,
    });

    // ACCOUNTS
    menu.push({
        label: i18n.t('divan.applicationMenu.file.label'),
        submenu: [
            {
                label: i18n.t('divan.applicationMenu.file.newAccount'),
                accelerator: 'CommandOrControl+N',
                click() {
                    Windows.createPopup('requestAccount', {
                        electronOptions: {
                            width: 420, height: 230, alwaysOnTop: true,
                        },
                    });
                },
            },
            {
                label: i18n.t('divan.applicationMenu.file.importPresale'),
                accelerator: 'CommandOrControl+I',
                enabled: bitherNode.isMainNetwork,
                click() {
                    Windows.createPopup('importAccount', {
                        electronOptions: {
                            width: 600, height: 370, alwaysOnTop: true,
                        },
                    });
                },
            },
            {
                type: 'separator',
            },
            {
                label: i18n.t('divan.applicationMenu.file.backup'),
                submenu: [
                    {
                        label: i18n.t('divan.applicationMenu.file.backupKeyStore'),
                        click() {
                            let userPath = Settings.userHomePath;

                            // eth
                            if (bitherNode.isEth) {
                                if (process.platform === 'win32') {
                                    userPath = `${Settings.appDataPath}\\Web3\\keys`;
                                } else {
                                    userPath += '/.web3/keys';
                                }

                            // bith
                            } else {
                                if (process.platform === 'darwin') {
                                    userPath += '/Library/Bither/keystore';
                                }

                                if (process.platform === 'freebsd' ||
                                process.platform === 'linux' ||
                                process.platform === 'sunos') {
                                    userPath += '/.bither/keystore';
                                }

                                if (process.platform === 'win32') {
                                    userPath = `${Settings.appDataPath}\\Bither\\keystore`;
                                }
                            }

                            shell.showItemInFolder(userPath);
                        },
                    }, {
                        label: i18n.t('divan.applicationMenu.file.backupDivan'),
                        click() {
                            shell.openItem(Settings.userDataPath);
                        },
                    },
                ],
            },
            {
                type: 'separator',
            },
            {
                label: i18n.t('divan.applicationMenu.file.swarmUpload'),
                accelerator: 'Shift+CommandOrControl+U',
                click() {
                    const focusedWindow = BrowserWindow.getFocusedWindow();
                    const paths = dialog.showOpenDialog(focusedWindow, {
                        properties: ['openFile', 'openDirectory']
                    });
                    if (paths && paths.length === 1) {
                        const isDir = fs.lstatSync(paths[0]).isDirectory();
                        const defaultPath = path.join(paths[0], 'index.html');
                        const uploadConfig = {
                            path: paths[0],
                            kind: isDir ? 'directory' : 'file',
                            defaultFile: fs.existsSync(defaultPath) ? '/index.html' : null
                        };
                        swarmNode.upload(uploadConfig).then((hash) => {
                            focusedWindow.webContents.executeJavaScript(`
                              Tabs.update('browser', {$set: {
                                  url: 'bzz://${hash}',
                                  redirect: 'bzz://${hash}'
                              }});
                              LocalStore.set('selectedTab', 'browser');
                            `);
                            console.log('Hash uploaded:', hash);
                        }).catch(e => console.log(e));
                    }
                }
            }]
    });

    // EDIT
    menu.push({
        label: i18n.t('divan.applicationMenu.edit.label'),
        submenu: [
            {
                label: i18n.t('divan.applicationMenu.edit.undo'),
                accelerator: 'CommandOrControl+Z',
                role: 'undo',
            },
            {
                label: i18n.t('divan.applicationMenu.edit.redo'),
                accelerator: 'Shift+CommandOrControl+Z',
                role: 'redo',
            },
            {
                type: 'separator',
            },
            {
                label: i18n.t('divan.applicationMenu.edit.cut'),
                accelerator: 'CommandOrControl+X',
                role: 'cut',
            },
            {
                label: i18n.t('divan.applicationMenu.edit.copy'),
                accelerator: 'CommandOrControl+C',
                role: 'copy',
            },
            {
                label: i18n.t('divan.applicationMenu.edit.paste'),
                accelerator: 'CommandOrControl+V',
                role: 'paste',
            },
            {
                label: i18n.t('divan.applicationMenu.edit.selectAll'),
                accelerator: 'CommandOrControl+A',
                role: 'selectall',
            },
        ],
    });

    // LANGUAGE (VIEW)
    const switchLang = langCode => function (menuItem, browserWindow) {
        try {
            // update i18next instance in browserWindow (Divan meteor interface)
            browserWindow.webContents.executeJavaScript(
               `TAPi18n.setLanguage("${langCode}");`
            );

            // set Accept_Language header
            const session = browserWindow.webContents.session;
            session.setUserAgent(session.getUserAgent(), langCode);

            // set navigator.language (dev console only)
            // browserWindow.webContents.executeJavaScript(
            //     `Object.defineProperty(navigator, 'language, {
            //         get() { return ${langCode}; }
            //     });`
            // );

            // reload browserWindow to apply language change
            // browserWindow.webContents.reload();
        } catch (err) {
            log.error(err);
        } finally {
            Settings.language = langCode;
            ipc.emit('backendAction_setLanguage');
        }
    };

    const currentLanguage = Settings.language;
    const languageMenu = Object.keys(i18n.options.resources)
    .filter(langCode => langCode !== 'dev')
    .map((langCode) => {
        const menuItem = {
            label: i18n.t(`divan.applicationMenu.view.langCodes.${langCode}`),
            type: 'checkbox',
            checked: (langCode === currentLanguage),
            click: switchLang(langCode),
        };
        return menuItem;
    });

    languageMenu.unshift({
        label: i18n.t('divan.applicationMenu.view.default'),
        click: switchLang(i18n.getBestMatchedLangCode(app.getLocale())),
    }, {
        type: 'separator',
    });

    // VIEW
    menu.push({
        label: i18n.t('divan.applicationMenu.view.label'),
        submenu: [
            {
                label: i18n.t('divan.applicationMenu.view.fullscreen'),
                accelerator: switchForSystem({
                    darwin: 'Command+Control+F',
                    default: 'F11',
                }),
                click() {
                    const mainWindow = Windows.getByType('main');

                    mainWindow.window.setFullScreen(!mainWindow.window.isFullScreen());
                },
            },
            {
                label: i18n.t('divan.applicationMenu.view.languages'),
                submenu: languageMenu,
            },
        ],
    });


    // DEVELOP
    const devToolsMenu = [];
    let devtToolsSubMenu;
    let curWindow;

    // change for wallet
    if (Settings.uiMode === 'divan') {
        devtToolsSubMenu = [{
            label: i18n.t('divan.applicationMenu.develop.devToolsDivanUI'),
            accelerator: 'Alt+CommandOrControl+I',
            click() {
                curWindow = BrowserWindow.getFocusedWindow();
                if (curWindow) {
                    curWindow.toggleDevTools();
                }
            },
        }, {
            type: 'separator',
        }];

        // add webviews
        webviews.forEach((webview) => {
            devtToolsSubMenu.push({
                label: i18n.t('divan.applicationMenu.develop.devToolsWebview', { webview: webview.name }),
                click() {
                    Windows.getByType('main').send('uiAction_toggleWebviewDevTool', webview._id);
                },
            });
        });

    // wallet
    } else {
        devtToolsSubMenu = [{
            label: i18n.t('divan.applicationMenu.develop.devToolsWalletUI'),
            accelerator: 'Alt+CommandOrControl+I',
            click() {
                curWindow = BrowserWindow.getFocusedWindow();
                if (curWindow) {
                    curWindow.toggleDevTools();
                }
            },
        }];
    }

    const externalNodeMsg = (bitherNode.isOwnNode) ? '' : ` (${i18n.t('divan.applicationMenu.develop.externalNode')})`;
    devToolsMenu.push({
        label: i18n.t('divan.applicationMenu.develop.devTools'),
        submenu: devtToolsSubMenu,
    });

    if (Settings.uiMode === 'divan') {
        devToolsMenu.push({
            label: i18n.t('divan.applicationMenu.develop.openRemix'),
            enabled: true,
            click() {
                Windows.createPopup('remix', {
                    url: 'https://remix.ethereum.org',
                    electronOptions: {
                        width: 1024,
                        height: 720,
                        center: true,
                        frame: true,
                        resizable: true,
                        titleBarStyle: 'default',
                    }
                });
            },
        });
    }

    devToolsMenu.push({
        label: i18n.t('divan.applicationMenu.develop.runTests'),
        enabled: (Settings.uiMode === 'divan'),
        click() {
            Windows.getByType('main').send('uiAction_runTests', 'webview');
        },
    });

    devToolsMenu.push({
        label: i18n.t('divan.applicationMenu.develop.logFiles') + externalNodeMsg,
        enabled: bitherNode.isOwnNode,
        click() {
            try {
                shell.showItemInFolder(`${Settings.userDataPath}/node.log`);
            } catch (e) {
                log.info(e);
            }
        },
    });

    // add node switching menu
    devToolsMenu.push({
        type: 'separator',
    });


    // add node switch
    if (process.platform === 'darwin' || process.platform === 'win32') {
        const nodeSubmenu = [];

        const ethClient = ClientBinaryManager.getClient('eth');
        const bithClient = ClientBinaryManager.getClient('bith');

        if (bithClient) {
            nodeSubmenu.push({
                label: `Bith ${bithClient.version}`,
                checked: bitherNode.isOwnNode && bitherNode.isBith,
                enabled: bitherNode.isOwnNode,
                type: 'checkbox',
                click() {
                    restartNode('bith', null, 'fast', webviews);
                },
            });
        }

        if (ethClient) {
            nodeSubmenu.push(
                {
                    label: `Eth ${ethClient.version} (C++)`,
                    checked: bitherNode.isOwnNode && bitherNode.isEth,
                    enabled: bitherNode.isOwnNode,
                    // enabled: false,
                    type: 'checkbox',
                    click() {
                        restartNode('eth');
                    },
                }
            );
        }

        devToolsMenu.push({
            label: i18n.t('divan.applicationMenu.develop.bitherNode'),
            submenu: nodeSubmenu,
        });
    }

    // add network switch
    devToolsMenu.push({
        label: i18n.t('divan.applicationMenu.develop.network'),
        submenu: [
            {
                label: i18n.t('divan.applicationMenu.develop.mainNetwork'),
                accelerator: 'CommandOrControl+Alt+1',
                checked: bitherNode.isOwnNode && bitherNode.isMainNetwork,
                enabled: bitherNode.isOwnNode,
                type: 'checkbox',
                click() {
                    restartNode(bitherNode.type, 'main');
                },
            },
            {
                label: 'Ropsten - Test network',
                accelerator: 'CommandOrControl+Alt+2',
                checked: bitherNode.isOwnNode && bitherNode.network === 'test',
                enabled: bitherNode.isOwnNode,
                type: 'checkbox',
                click() {
                    restartNode(bitherNode.type, 'test');
                },
            },
            {
                label: 'Rinkeby - Test network',
                accelerator: 'CommandOrControl+Alt+3',
                checked: bitherNode.isOwnNode && bitherNode.network === 'rinkeby',
                enabled: bitherNode.isOwnNode,
                type: 'checkbox',
                click() {
                    restartNode(bitherNode.type, 'rinkeby');
                },
            },
            {
                label: 'Solo network',
                accelerator: 'CommandOrControl+Alt+4',
                checked: bitherNode.isOwnNode && bitherNode.isDevNetwork,
                enabled: bitherNode.isOwnNode,
                type: 'checkbox',
                click() {
                    restartNode(bitherNode.type, 'dev');
                },
            }
        ] });

    // Light mode switch should appear when not in Solo Mode (dev network)
    if (bitherNode.isOwnNode && bitherNode.isbith && !bitherNode.isDevNetwork) {
        devToolsMenu.push({
            label: 'Sync with Light client (beta)',
            enabled: true,
            checked: bitherNode.isLightMode,
            type: 'checkbox',
            click() {
                restartNode('bith', null, (bitherNode.isLightMode) ? 'fast' : 'light');
            },
        });
    }

    // Enables mining menu: only in Solo mode and Ropsten network (testnet)
    if (bitherNode.isOwnNode && (bitherNode.isTestNetwork || bitherNode.isDevNetwork)) {
        devToolsMenu.push({
            label: (global.mining) ? i18n.t('divan.applicationMenu.develop.stopMining') : i18n.t('divan.applicationMenu.develop.startMining'),
            accelerator: 'CommandOrControl+Shift+M',
            enabled: true,
            click() {
                if (global.mining) {
                    stopMining(webviews);
                } else {
                    startMining(webviews);
                }
            }
        });
    }

    menu.push({
        label: ((global.mining) ? '⛏ ' : '') + i18n.t('divan.applicationMenu.develop.label'),
        submenu: devToolsMenu,
    });

    // WINDOW
    menu.push({
        label: i18n.t('divan.applicationMenu.window.label'),
        role: 'window',
        submenu: [
            {
                label: i18n.t('divan.applicationMenu.window.minimize'),
                accelerator: 'CommandOrControl+M',
                role: 'minimize',
            },
            {
                label: i18n.t('divan.applicationMenu.window.close'),
                accelerator: 'CommandOrControl+W',
                role: 'close',
            },
            {
                type: 'separator',
            },
            {
                label: i18n.t('divan.applicationMenu.window.toFront'),
                role: 'front',
            },
        ],
    });

    // HELP
    const helpMenu = [];

    if (process.platform === 'freebsd' || process.platform === 'linux' ||
            process.platform === 'sunos' || process.platform === 'win32') {
        helpMenu.push(
            {
                label: i18n.t('divan.applicationMenu.app.about', { app: Settings.appName }),
                click() {
                    Windows.createPopup('about', {
                        electronOptions: {
                            width: 420,
                            height: 230,
                            alwaysOnTop: true,
                        },
                    });
                },
            },
            {
                label: i18n.t('divan.applicationMenu.app.checkForUpdates'),
                click() {
                    updateChecker.runVisibly();
                },
            }
        );
    }
    helpMenu.push({
        label: i18n.t('divan.applicationMenu.help.divanWiki'),
        click() {
            shell.openExternal('https://github.com/bitherhq/divan/wiki');
        },
    }, {
        label: i18n.t('divan.applicationMenu.help.gitter'),
        click() {
            shell.openExternal('https://gitter.im/bitherhq/divan');
        },
    }, {
        label: i18n.t('divan.applicationMenu.help.reportBug'),
        click() {
            shell.openExternal('https://github.com/bitherhq/divan/issues');
        },
    });

    menu.push({
        label: i18n.t('divan.applicationMenu.help.label'),
        role: 'help',
        submenu: helpMenu,
    });
    return menu;
};


module.exports = createMenu;
