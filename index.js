const fs = require('fs');
const path = require('path');
const util = require('util');

const DATA_PATH = path.join(__dirname, 'data');
const TARGET_FILE = path.join(__dirname, 'dist', 'data.json');

const scripts = {
    build: async function () {
        const dirs = ['episodes', 'takumi'];
        const fileReg = /\.json$/;
        const baseContent = await util.promisify(fs.readFile)(path.join(DATA_PATH, 'base.json'));
        const baseData = JSON.parse(baseContent);
        const totalData = Object.assign({}, baseData);

        for (const dir of dirs) {
            const data = [];
            const dirPath = path.join(DATA_PATH, dir);
            let fileList = await util.promisify(fs.readdir)(dirPath);

            fileList = fileList.filter((name) => fileReg.test(name));
            if (dir === 'episodes') {
                fileList.sort(sortFiles);
            } else {
                fileList.sort();
            }

            for (const fileName of fileList) {
                if (!fileReg.test(fileName)) {
                    continue;
                }
                console.log(`Read: ${dir}/${fileName}`);
                const filePath = path.join(dirPath, fileName);
                const fileContent = await util.promisify(fs.readFile)(filePath);
                const fileData = JSON.parse(fileContent);
                data.push(fileData);
            }

            totalData[dir] = data;
        }

        await util.promisify(fs.writeFile)(TARGET_FILE, JSON.stringify(totalData));
        console.log('Build done.');
    },
    split: async function () {
        const totalContent = await util.promisify(fs.readFile)(path.join(__dirname, 'dist', 'data.json'));
        const totalData = JSON.parse(totalContent);
        const fileList = [];
        
        for (const item of totalData.episodes) {
            let filename;
            let filepath;
            if (typeof item.number === 'number') {
                if (item.number !== 0) {
                    filename = `${item.number}`;
                } else {
                    let dateStr = item.aired.replace(/-/g, '');
                    filename = `0-${dateStr}`;
                }

                while (fileList.includes(filename)) {
                    let count = Number(filename.split('-')[1]);
                    count = Number.isNaN(count) ? 1 : ++count;
                    filename = `${item.number}-${count}`;
                }
                fileList.push(filename);
                filepath = path.join(DATA_PATH, 'episodes', `${filename}.json`);

                await util.promisify(fs.writeFile)(filepath, JSON.stringify(item, null, 4));
                console.log(`${filename} saved.`);
            } else {
                console.log(JSON.stringify(item, null, 4));
            }
        }
    },
    scan: async function () {
        // const scandir = path.join(DATA_PATH, 'takumi');
        const scandir = path.join(DATA_PATH, 'episodes');
        const fileReg = /\.json$/;
        let fileList = await util.promisify(fs.readdir)(scandir);

        fileList = fileList.filter((name) => fileReg.test(name));
        fileList.sort(sortFiles);
        // fileList.sort();

        for (const fileName of fileList) {
            const filePath = path.join(scandir, fileName);
            const fileContent = await util.promisify(fs.readFile)(filePath);
            const fileData = JSON.parse(fileContent);

            if (fileData.number !== 0 && typeof fileData.budget !== 'number' && fileData.budget !== null) {
                console.log(`${fileName} no budget.`);
            }
            if (fileData.number !== 0 && typeof fileData.prefecture !== 'string') {
                console.log(`${fileName} no prefecture.`);
            }
            // if (typeof fileData.birthyear !== 'number') {
                // console.log(`${fileName} no birthyear.`);
            // }
        }
    },
    fix1: async function () {
        const fileReg = /\.json$/;
        const scandir = path.join(DATA_PATH, 'episodes');
        let fileList = await util.promisify(fs.readdir)(scandir);

        fileList = fileList.filter((name) => fileReg.test(name));
        fileList.sort(sortFiles);

        for (const fileName of fileList) {
            const filePath = path.join(scandir, fileName);
            const filePath2 = path.join(scandir, 'original', fileName);

            if (fs.existsSync(filePath2)) {
                continue;
            }

            const fileContent = await util.promisify(fs.readFile)(filePath);
            let fileData = JSON.parse(fileContent);

            if (fileData.number === 0) {
                continue;
            }

            const nameMatch = fileData.title.match(/^(.+)（(.+)）$/);
            if (nameMatch) {
                const newData = {};
                for (const key in fileData) {
                    switch (key) {
                        case 'title':
                            newData['name'] = nameMatch[1];
                            newData['name:zh'] = nameMatch[2];
                            break;
                        default:
                            newData[key] = fileData[key];
                    }
                }
                fileData = newData;
                await util.promisify(fs.rename)(filePath, filePath2);
                await util.promisify(fs.writeFile)(filePath, JSON.stringify(fileData, null, 4));
                console.log(`${fileName} fixed.`);
            }
        }
    }
};

function convertNumber(s) {
    const n = Number(s);
    return Number.isNaN(n) ? 0 : n;
}

function sortFiles(a, b) {
    const part1 = a.replace('.json', '').split('-').map(convertNumber);
    const part2 = b.replace('.json', '').split('-').map(convertNumber);
    if (part1[0] > part2[0]) {
        return 1;
    }
    if (part1[0] < part2[0]) {
        return -1;
    }
    if (part1[1] > part2[1]) {
        return 1;
    }
    if (part1[1] < part2[1]) {
        return -1;
    }
    return 0;
}

(async function () {
    const command = process.argv[2];
    if (command in scripts) {
        await scripts[command].call();
    } else {
        return Promise.reject(new Error('Script not found.'));
    }
})().catch(console.error);
