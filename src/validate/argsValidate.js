const core = require("@serverless-devs/core");

const {lodash, loadComponent} = core;
async function validateArgs(afterDeployParams, args, logger) {
    const {
        service,
        baseVersion,
        canaryStep,
        canaryWeight,
        canaryPlans,
        linearStep
    } = args;

    // check whether service in the plugin args is equal to the service deployed.
    let curService;
    if (service !== undefined) {
        const serviceDeployed = afterDeployParams && afterDeployParams.props && afterDeployParams.props.service && afterDeployParams.props.service.name;
        if (serviceDeployed !== service) {
            throw new Error(`The plugin's service is unequal to service deployed. ` + `Name of service in the plugin: ${service}` + ` Name of service deployed: ${serviceDeployed}`)
        }
        curService = service;
    } else {
        curService = lodash.get(afterDeployParams, 'props.service.name');
    }

    if (baseVersion !== undefined) {
        await validateBaseVersion(curService, baseVersion, afterDeployParams, logger);
    }

    validateGrayscaleStrategy(canaryStep, canaryWeight, canaryPlans, linearStep, logger);

}

/**
 * Grayscale Strategy, only one of the following parameters can be selected, if not specified then no grayscale
 * @param canaryStep
 * @param canaryWeight
 * @param canaryPlans
 * @param linearStep
 * @param logger
 */
function validateGrayscaleStrategy(canaryStep, canaryWeight, canaryPlans, linearStep, logger) {
    let grayList = [];
    if (canaryStep !== undefined) {
        grayList.push(canaryStep);
    }
    if (canaryWeight !== undefined) {
        grayList.push(canaryWeight);
    }
    if (canaryPlans !== undefined) {
        grayList.push(canaryPlans);
    }
    if (linearStep !== undefined) {
        grayList.push(linearStep);
    }
    console.log(grayList);
    if (grayList.length === 0) {
        logger.warn('No grayscale strategy specified, The new version will not use Grayscale Release');
    } else if (grayList.length > 1) {
        throw new Error(`Choose at most one grayscale strategy! You chose ${grayList.length} strategies`);
    } else {
        // begin validate the strategy
        const grayStrategy = grayList[0];
        // only canaryPlans input is an array.
        if (grayStrategy.constructor.name === "Array") {
            // each plan in canaryPlans can't have a weight > 100
            for (const plan of grayStrategy) {
                console.log(plan);
                if (plan.weight === undefined ) {

                    throw new Error(`Weight is required`);
                }
                if (plan.interval === undefined) {
                    throw new Error(`Interval is required`);
                }

                if (plan.weight > 100) {
                    throw new Error(`Plans in canaryPlans can't have a weight > 100`);
                }
            }
        }

        // linearStep and canaryStep
        if (grayStrategy.constructor.name === "Object") {
            if (grayStrategy.weight === undefined) {
                throw new Error('Weight is required')
            }
            if (grayStrategy.weight > 100) {
                throw new Error(`plans in canaryPlans can't have a weight > 100`);
            }
        }


        // todo canaryWeight




    }



}


/**
 * check whether baseVersion must exist online.
 * @param curService
 * @param baseVersion
 * @param afterDeployParams
 * @param logger
 * @returns {Promise<void>}
 */
async function validateBaseVersion(curService, baseVersion, afterDeployParams, logger) {
    if (typeof baseVersion !== "number") {
        throw new Error(`baseVersion is not number, baseVersion: ${baseVersion}, typeof baseVersion: ${typeof baseVersion}`);
    }
    const fc = await loadComponent('devsapp/fc');
    const versionInputs = lodash.assign(afterDeployParams, {
        'args': `list --service-name ${curService}`
    })

    const versionList = await fc.version(versionInputs);

    const versionIdList = versionList.map((version) => {
        return  version.versionId;
    })
    logger.log(versionIdList);

    if (!versionIdList.includes(baseVersion.toString())) {
        throw new Error(`baseVersion in args doesn't exist. baseVersion: ${baseVersion}`);
    }

}


module.exports = {validateArgs}
