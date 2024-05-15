const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const cliProgress = require('cli-progress');
const crypto  = require('crypto');

const { argv } = require('process');


if (isMainThread) {

    let simData = {completedSims: [], simFailures: [], failures: 0, completed: 0, total: 0, avgMoneyOfCompletion:0, totalMoneyOfCompletion:0, averageIterations:0, totalIterations:0};
    let uuid = crypto.randomUUID()

    let maxSimulations = argv[2] || 1000;

    const loadingBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    loadingBar.start(maxSimulations, 0);

    function createSimWorker(){
        const config = JSON.parse(fs.readFileSync('simConfig.json'));
        const startingMoney = argv[4] || config.startingMoney;
        const startingBet = argv[5] || config.startingBet;
        const winChance = argv[6] || config.winChance;
        const winMult = argv[7] || config.winMult;
        const maxIterations = argv[8] || config.maxIterations;
        const maxTime = argv[9] || config.maxTime;
        const targetMoney = argv[10] || config.targetMoney;


        const worker = new Worker(__filename, {
                workerData: {
                    startingMoney: startingMoney,
                    startingBet: startingBet,
                    winChance: winChance,
                    winMult: winMult,
                    maxIterations: maxIterations,
                    maxTime: maxTime,
                    targetMoney: targetMoney
                }
        });
        worker.on('message', (message) => {
            if (message.simData){
                simData.completedSims.push(...message.completedSims);
                simData.simFailures.push(...message.simFailures);
                simData.completed += message.completedSims.length;
                simData.failures += message.simFailures.length;
                simData.total += message.completedSims.length + message.simFailures.length;


                simData.totalMoneyOfCompletion += message.money;
                simData.avgMoneyOfCompletion = Number((simData.totalMoneyOfCompletion / simData.completed));

                simData.totalIterations += message.iterations;
                simData.averageIterations = Number((simData.totalIterations / simData.total));

                simData.successRate = Number((100 * simData.completed / simData.total).toFixed(2)) + '%';
                simData.failRate = Number((100 * simData.failures / simData.total).toFixed(2)) + '%';

                simData.startingMoney = startingMoney + '$';
                simData.startingBet = startingBet + '$';
                simData.winChance = (winChance * 100) + '%';
                simData.winMult = winMult + 'x';
                simData.maxIterationsPerSim = Number(maxIterations) + ' iterations';
                simData.maxTimePerSim = maxTime + 's';

                simData.targetMoney = targetMoney + '$';



                loadingBar.update(simData.total);

                if (simData.total >= maxSimulations){
                    fs.writeFileSync(`results/${uuid}-${winChance}.json`, JSON.stringify(simData, null, 2));

                    simData.completedSims = []; // reset the data so it's not logged
                    simData.simFailures = []; // reset the data so it's not logged
                    console.log(JSON.stringify(simData, null, 2));
                    

                    loadingBar.stop();
                
                    // exit the process
                    process.exit(0);
                }
            }
        });
        worker.postMessage('start');
    }

    
    
    const sims = argv[3] || 5;

    for (let i = 0; i < sims; i++){
        createSimWorker();
    }   
}
else{
    const data = workerData;

    parentPort.on('message', (message) => {
        if (message === 'start') {
            while (true){
                runSim();
            }
        }
    });

    function runSim(){
        let params = structuredClone(data);
        const simData = headlessSimulation(params.startingMoney, params.startingBet, params.winChance, params.winMult, params.maxIterations, params.maxTime, params.targetMoney);
        parentPort.postMessage({simData: simData, completedSims: simData[0], simFailures: simData[1], money: simData[2], iterations: simData[3]});
    }
}



function headlessSimulation(startingMoney, startingBet, winChance, winMult, maxIterations = 1000000, maxTime = 500, targetMoney = Infinity){
    let money = startingMoney;
    let currentBet = startingBet;
    let lossStreak = 0;
    let maxMoney = money;
    let iterations = 0;
    let maxLossStreak = 0;
    let loseAllStreak = 0;
    let loseAllProb = 0;
    let losses = 0;
    let wins = 0;

    let completedSims = [];
    let simFailures = [];

    const startTime = performance.now();
    const endTime = startTime + maxTime * 1000;

    while (true){
        const result = takeTurn();
        if (result){
            return [completedSims, simFailures, money, iterations];
        }
    }



    function takeTurn(){
        if (money >= targetMoney){
            completedSims.push({money, iterations, lossStreak});
            return [maxMoney, iterations, lossStreak];
        }

        if (performance.now() > endTime){
            completedSims.push({money, iterations, lossStreak});
            return [maxMoney, iterations, lossStreak];
        }

        if (iterations >= maxIterations){
            completedSims.push({money, iterations, maxLossStreak});
            return [maxMoney, iterations, lossStreak];
        }

        if ((money - currentBet) < 0 || money <= 0){
            simFailures.push({money, iterations, maxLossStreak});
            return [maxMoney, iterations, lossStreak];
        }
        
        money -= currentBet;
        if(Math.random() < winChance){
            money += currentBet * winMult;
            currentBet = startingBet;
            lossStreak = 0;
            wins++;
        }
        
        else{
            currentBet *= 2;
            lossStreak++;
            losses++;
        }
        
        money = Number(money.toFixed(4))
        money = Math.max(0, money)
        
        maxMoney = Math.max(money, maxMoney)
        
        iterations++;
        maxLossStreak = Math.max(maxLossStreak, lossStreak)
        
        loseAllStreak = Math.floor(Math.log(((money * (2-1)) / (currentBet))+1) / Math.log(2));
        loseAllProb = Math.min(Number((100 * (1-winChance) ** loseAllStreak).toFixed(4)), 100)
        
        if (loseAllProb >  50){
            //currentBet = startingBet;
        }
        
        
        
        
        startingBet = money/10000;
        startingBet = Math.max(startingBet, 0.01)
        
        startingBet = Number(startingBet.toFixed(2))

        return false;
    }
}