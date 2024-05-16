const child_process = require('child_process');
const fs = require('fs');

const simTester = (maxSimulations, startingMoney, startingBet, winChance, winMult, maxIterations, maxTime, targetMoney) => {
    return new Promise((resolve, reject) => {
        const child = child_process.exec(`node simulator.js ${maxSimulations} 1 ${startingMoney} ${startingBet} ${winChance} ${winMult} ${maxIterations} ${maxTime} ${targetMoney}`, (err, stdout, stderr) => {
            if (err) {
                reject(err);
            }
            resolve(stdout);
        });
    });
}

async function testMultiplyers(){
    const startingMoney = 10;
    const startingBet = 0.01;
    const maxIterations = 10000;
    const maxTime = 10;
    const targetMoney = 50;
    const maxSimulations = 100000;
    const winMults = [9.9, 4.95, 3.3, 2.475, 1.98, 1.65, 1.4143, 1.2375, 1.1];
    const winChances = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const results = [];

    for (let i = 0; i < winMults.length; i++){
        const winChance = winChances[i];
        const winMult = winMults[i];
        const result = await simTester(maxSimulations, startingMoney, startingBet, winChance, winMult, maxIterations, maxTime, targetMoney);
        results.push(JSON.parse(result));
    }

    fs.writeFile('results.json', JSON.stringify(results, null, 4), (err) => {
        if (err) {
            console.log(err);
        }
    });
   
}

testMultiplyers();