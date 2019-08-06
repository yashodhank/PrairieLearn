// @ts-check
const ERR = require('async-stacktrace');
const path = require('path');
const _ = require('lodash');
const fs = require('fs');
const util = require('util');
const async = require('async');
const moment = require('moment');
const schemas = require('../schemas');

const jsonLoad = require('../lib/json-load');

const DEFAULT_QUESTION_INFO = {
    type: 'Calculation',
    clientFiles: ['client.js', 'question.html', 'answer.html'],
};
const DEFAULT_COURSE_INSTANCE_INFO = {};
const DEFAULT_ASSESSMENT_INFO = {};

const DEFAULT_ASSESSMENT_SETS = [
    {'abbreviation': 'HW', 'name': 'Homework', 'heading': 'Homeworks', 'color': 'green1'},
    {'abbreviation': 'Q', 'name': 'Quiz', 'heading': 'Quizzes', 'color': 'red1'},
    {'abbreviation': 'PQ', 'name': 'Practice Quiz', 'heading': 'Practice Quizzes', 'color': 'pink1'},
    {'abbreviation': 'E', 'name': 'Exam', 'heading': 'Exams', 'color': 'brown1'},
    {'abbreviation': 'PE', 'name': 'Practice Exam', 'heading': 'Practice Exams', 'color': 'yellow1'},
    {'abbreviation': 'P', 'name': 'Prep', 'heading': 'Question Preparation', 'color': 'gray1'},
    {'abbreviation': 'MP', 'name': 'Machine Problem', 'heading': 'Machine Problems', 'color': 'turquoise1'},
];

const DEFAULT_TAGS = [
    {'name': 'numeric', 'color': 'brown1', 'description': 'The answer format is one or more numerical values.'},
    {'name': 'symbolic', 'color': 'blue1', 'description': 'The answer format is a symbolic expression.'},
    {'name': 'drawing', 'color': 'yellow1', 'description': 'The answer format requires drawing on a canvas to input a graphical representation of an answer.'},
    {'name': 'MC', 'color': 'green1', 'description': 'The answer format is choosing from a small finite set of answers (multiple choice, possibly with multiple selections allowed, up to 10 possible answers).'},
    {'name': 'code', 'color': 'turquoise1', 'description': 'The answer format is a piece of code.'},
    {'name': 'multianswer', 'color': 'orange2', 'description': 'The question requires multiple answers, either as steps in a sequence or as separate questions.'},
    {'name': 'graph', 'color': 'purple1', 'description': 'The question tests reading information from a graph or drawing a graph.'},
    {'name': 'concept', 'color': 'pink1', 'description': 'The question tests conceptual understanding of a topic.'},
    {'name': 'calculate', 'color': 'green2', 'description': 'The questions tests performing a numerical calculation, with either a calculator or equivalent software.'},
    {'name': 'compute', 'color': 'purple1', 'description': 'The question tests the writing and running of a piece of code to compute the answer. The answer itself is not the code, but could be a numeric answer output by the code, for example (use `code` when the answer is the code).'},
    {'name': 'software', 'color': 'orange1', 'description': 'The question tests the use of a specific piece of software (e.g., Matlab).'},
    {'name': 'estimation', 'color': 'red2', 'description': 'Answering the question correctly will require some amount of estimation, so an exact answer is not possible.'},
    {'name': 'secret', 'color': 'red3', 'description': 'Only use this question on exams or quizzes that won\'t be released to students, so the question can be kept secret.'},
    {'name': 'nontest', 'color': 'green3', 'description': 'This question is not appropriate for use in a restricted testing environment, so only use it on homeworks or similar.'},
    {'name': 'Sp15', 'color': 'gray1'},
    {'name': 'Su15', 'color': 'gray1'},
    {'name': 'Fa15', 'color': 'gray1'},
    {'name': 'Sp16', 'color': 'gray1'},
    {'name': 'Su16', 'color': 'gray1'},
    {'name': 'Fa16', 'color': 'gray1'},
    {'name': 'Sp17', 'color': 'gray1'},
    {'name': 'Su17', 'color': 'gray1'},
    {'name': 'Fa17', 'color': 'gray1'},
    {'name': 'Sp18', 'color': 'gray1'},
    {'name': 'Su18', 'color': 'gray1'},
    {'name': 'Fa18', 'color': 'gray1'},
    {'name': 'Sp19', 'color': 'gray1'},
    {'name': 'Su19', 'color': 'gray1'},
    {'name': 'Fa19', 'color': 'gray1'},
    {'name': 'Sp20', 'color': 'gray1'},
    {'name': 'Su20', 'color': 'gray1'},
    {'name': 'Fa20', 'color': 'gray1'},
    {'name': 'Sp21', 'color': 'gray1'},
    {'name': 'Su21', 'color': 'gray1'},
    {'name': 'Fa21', 'color': 'gray1'},
];

function loadCourseInfo(courseDir, logger, callback) {
    const courseInfoFilename = path.join(courseDir, 'infoCourse.json');
    const courseInfo = {};
    jsonLoad.readInfoJSON(courseInfoFilename, schemas.infoCourse, function(err, info) {
        if (ERR(err, callback)) return;
        courseInfo.uuid = info.uuid.toLowerCase();
        courseInfo.path = courseDir;
        courseInfo.name = info.name;
        courseInfo.title = info.title;
        courseInfo.timezone = info.timezone;
        // TODO: no longer used
        courseInfo.userRoles = info.userRoles;
        courseInfo.questionsDir = path.join(courseDir, 'questions');
        courseInfo.courseInstancesDir = path.join(courseDir, 'courseInstances');
        courseInfo.topics = info.topics;
        courseInfo.assessmentSets = info.assessmentSets || [];
        _.each(DEFAULT_ASSESSMENT_SETS, function(aset) {
            if (_.find(courseInfo.assessmentSets, ['name', aset.name])) {
                logger.warn('WARNING: Default assessmentSet "' + aset.name + '" should not be included in infoCourse.json');
            } else {
                courseInfo.assessmentSets.push(aset);
            }
        });
        courseInfo.tags = info.tags || [];
        _.each(DEFAULT_TAGS, function(tag) {
            if (_.find(courseInfo.tags, ['name', tag.name])) {
                logger.warn('WARNING: Default tag "' + tag.name + '" should not be included in infoCourse.json');
            } else {
                courseInfo.tags.push(tag);
            }
        });

        // Course options
        courseInfo.options = {};
        courseInfo.options.useNewQuestionRenderer = _.get(info, 'options.useNewQuestionRenderer', false);
        courseInfo.options.isExampleCourse = false;
        if (courseInfo.uuid == 'fcc5282c-a752-4146-9bd6-ee19aac53fc5'
            && courseInfo.title == 'Example Course'
            && courseInfo.name == 'XC 101') {
                courseInfo.options.isExampleCourse = true;
        }

        courseInfo.jsonFilename = info.jsonFilename;
        callback(null, courseInfo);
    });
}

function loadQuestion() {}

function checkInfoValid(idName, info, infoFile, courseInfo, logger, cache) {
    var myError = null;

    // check assessments all have a valid assessmentSet
    if (idName == 'tid') {
        let { validAssessmentSets } = cache;
        if (!validAssessmentSets) {
            validAssessmentSets = new Set(courseInfo.assessmentSets.map(as => as.name));
            cache.validAssessmentSets = validAssessmentSets;
        }
        if (courseInfo.assessmentSets && !validAssessmentSets.has(info.set)) {
            return new Error(infoFile + ': invalid "set": "' + info.set + '" (must be a "name" of the "assessmentSets" listed in infoCourse.json)');
        }
        // check assessment access rules
        if (_(info).has('allowAccess')) {
            _(info.allowAccess).forEach(function(rule) {
                if ('startDate' in rule) {
                    var startDate = moment(rule.startDate, moment.ISO_8601);
                    if (startDate.isValid() == false) {
                        myError = new Error(`${infoFile}: invalid allowAccess startDate: ${rule.startDate}`);
                        return false;
                    }
                }
                if ('endDate' in rule) {
                    var endDate = moment(rule.endDate, moment.ISO_8601);
                    if (endDate.isValid() == false) {
                        myError = new Error(`${infoFile}: invalid allowAccess endDate: ${rule.startDate}`);
                        return false;
                    }
                }
                if ('startDate' in rule && 'endDate' in rule) {
                    if (startDate.isAfter(endDate)) {
                        myError = new Error(`${infoFile}: invalid allowAccess rule: startDate (${rule.startDate}) must not be after endDate (${rule.endDate})`);
                        return false;
                    }
                }
            });
        }
        if (myError) {
            return myError;
        }
    }

    // checks for infoCourseInstance.json
    if (idName == 'ciid') {
        if (_(info).has('allowIssueReporting')) {
            if (info.allowIssueReporting) {
                logger.warn(`WARNING: ${infoFile}: "allowIssueReporting" is no longer needed.`);
            } else {
                return new Error(`${infoFile}: "allowIssueReporting" is no longer permitted in "infoCourseInstance.json". Instead, set "allowIssueReporting" in "infoAssessment.json" files.`);
            }
        }
    }

    return null;
}

async function loadAndValidateJson(id, idName, jsonPath, defaults, schema, optionSchemaPrefix, courseInfo, cache, logger) {
    let json;
    try {
        json = await jsonLoad.readInfoJSONAsync(jsonPath, schema);
    } catch (err) {
        if (err && err.code && err.path && (err.code === 'ENOTDIR') && err.path === jsonPath) {
            // In a previous version of this code, we'd pre-filter
            // all files in the parent directory to remove anything
            // that may have accidentally slipped in, like .DS_Store.
            // However, that resulted in a huge number of system calls
            // that got really slow for large directories. Now, we'll
            // just blindly try to read a file from the directory and assume
            // that if we see ENOTDIR, that means the directory was not
            // in fact a directory.
            return undefined;
        }
        // This is another error, possibly validation-related. Just re-throw it.
        throw err;
    }

    await jsonLoad.validateOptionsAsync(json, jsonPath, optionSchemaPrefix, schemas);
    json[idName] = id;
    const optionsError = checkInfoValid(idName, json, jsonPath, courseInfo, logger, cache);
    if (optionsError) throw optionsError;

    return _.defaults(json, defaults);
}

function loadInfoDB(idName, parentDir, infoFilename, defaultInfo, schema, optionSchemaPrefix, courseInfo, logger, callback) {
    // `cache` is an object with which we can cache information derived from course info
    // in between successive calls to `checkInfoValid`
    const cache = {};
    const db = {};
    fs.readdir(parentDir, function(err, files) {
        if (ERR(err, callback)) return;

        async.each(files, async function(dir) {
            const infoFile = path.join(parentDir, dir, infoFilename);
            const info = await loadAndValidateJson(dir, idName, infoFile, defaultInfo, schema, optionSchemaPrefix, courseInfo, cache,logger);
            if (info) {
                db[dir] = info;
            }
        }, function(err) {
            if (ERR(err, callback)) return;
            logger.debug('successfully loaded info from ' + parentDir + ', number of items = ' + _.size(db));
            callback(null, db);
        });
    });
}

/**
 * @param {string} courseDir The directory of the course
 * @param {string} qid The QID of the question to load
 * @param {any} logger An object to log job output to
 */
module.exports.loadSingleQuestion = async function(courseDir, qid, logger) {
    // TODO: we can probably refactor loadAndValidateJson to not need `courseInto`
    const courseInfo = {};
    // No need to cache, only a single call here
    const cache = {};
    const infoQuestionPath = path.join(courseDir, 'questions', qid, 'info.json');
    return await loadAndValidateJson(qid, 'qid', infoQuestionPath, DEFAULT_QUESTION_INFO, schemas.infoQuestion, 'questionOptions', courseInfo, cache, logger);
};

module.exports.loadFullCourse = function(courseDir, logger, callback) {
    const course = {};
    async.series([
        function(callback) {
            loadCourseInfo(courseDir, logger, function(err, courseInfo) {
                if (ERR(err, callback)) return;
                course.courseInfo = courseInfo;
                callback(null);
            });
        },
        function(callback) {
            loadInfoDB('qid', course.courseInfo.questionsDir, 'info.json', DEFAULT_QUESTION_INFO, schemas.infoQuestion, 'questionOptions', course.courseInfo, logger, function(err, questionDB) {
                if (ERR(err, callback)) return;
                course.questionDB = questionDB;
                callback(null);
            });
        },
        function(callback) {
            loadInfoDB('ciid', course.courseInfo.courseInstancesDir, 'infoCourseInstance.json', DEFAULT_COURSE_INSTANCE_INFO, schemas.infoCourseInstance, null, course.courseInfo, logger, function(err, courseInstanceDB) {
                if (ERR(err, callback)) return;
                course.courseInstanceDB = courseInstanceDB;
                callback(null);
            });
        },
    ], function(err) {
        if (ERR(err, callback)) return;
        async.forEachOf(course.courseInstanceDB, function(courseInstance, courseInstanceDir, callback) {
            var assessmentsDir = path.join(course.courseInfo.courseInstancesDir, String(courseInstanceDir), 'assessments');
            courseInstance.assessmentDB = {};
            // Check that the assessments folder exists and is accessible before loading from it
            fs.lstat(assessmentsDir, function(err, stats) {
                if (err) {
                    // ENOENT: Directory does not exist
                    if (err.code == 'ENOENT') {
                        logger.warn(`Warning: ${courseInstanceDir} has no \`assessments\` directory (lstat error code ENOENT).`);
                    }
                    // Other access permissions error
                    else {
                        logger.warn(`Warning: \`${courseInstanceDir}/assessments\` is inaccessible (lstat error code ${err.code}).`);
                    }
                    // The above handles the error
                    callback(null);
                }
                // ENOTDIR: `assessments` is not a directory
                else if (!stats.isDirectory()) {
                    logger.warn(`Warning: \`${courseInstanceDir}/assessments\` is not a directory.`);
                    // This handles the error
                    callback(null);
                }
                else {
                    loadInfoDB('tid', assessmentsDir, 'infoAssessment.json', DEFAULT_ASSESSMENT_INFO, schemas.infoAssessment, null, course.courseInfo, logger, function(err, assessmentDB) {
                        if (ERR(err, callback)) return;
                        courseInstance.assessmentDB = assessmentDB;
                        callback(null);
                    });
                }
            });
        }, function(err) {
            if (ERR(err, callback)) return;
            callback(null, course);
        });
    });
};

/**
 * @template T
 * @typedef {object} Either Contains either an error or data; data may include warnings.
 * @property {string} [error]
 * @property {string} [warning]
 * @property {T} [data]
 */

/**
 * @typedef {Object} CourseOptions
 * @property {boolean} useNewQuestionRenderer
 * @property {boolean} isExampleCourse
 */

/**
 * @typedef {Object} Tag
 * @property {string} name
 * @property {string} color
 * @property {string} [description]
 */

/**
 * @typedef {Object} Topic
 * @property {string} name
 * @property {string} color
 * @property {string} description
 */

/**
 * @typedef {Object} AssessmentSet
 * @property {string} abbreviation
 * @property {string} name
 * @property {string} heading
 * @property {string} color
 */

/** 
 * @typedef {Object} Course
 * @property {string} uuid
 * @property {string} name
 * @property {string} title
 * @property {string} path
 * @property {string} timezone
 * @property {CourseOptions} options
 * @property {Tag[]} tags
 * @property {Topic[]} topics
 * @property {AssessmentSet[]} assessmentSets
 */

/** @typedef {"Student" | "TA" | "Instructor" | "Superuser"} UserRole */
/** @typedef {"UIUC" | "ZJUI" | "LTI" | "Any"} Institution */

/**
 * @typedef {Object} CourseInstanceAllowAccess
 * @property {UserRule} role
 * @property {string[]} uids
 * @property {string} startDate
 * @property {string} endDate
 * @property {Institution} institution
 */

/**
 * @typedef {Object} CourseInstance
 * @property {string} uuid
 * @property {string} longName
 * @property {number} number
 * @property {string} timezone
 * @property {{ [uid: string]: "Student" | "TA" | "Instructor"}} userRoles
 * @property {CourseInstanceAllowAccess[]} allowAccess
 */

/**
 * @typedef {Object} SEBConfig
 * @property {string} password
 * @property {string} quitPassword
 * @property {string[]} allowPrograms
 */

/**
 * @typedef {Object} AssessmentAllowAccess
 * @property {"Public" | "Exam" | "SEB"} mode
 * @property {string} examUuid
 * @property {"Student" | "TA" | "Instructor"} role
 * @property {string[]} uids
 * @property {number} credit
 * @property {string} startDate
 * @property {string} endDate
 * @property {number} timeLimitMin
 * @property {string} password
 * @property {SEBConfig} SEBConfig
 */

 /**
  * @typedef {Object} QuestionAlternative
  * @property {number | number[]} points
  * @property {numer | number[]} maxPoints
  * @property {string} id
  * @property {boolean} forceMaxPoints
  * @property {number} triesPerVariant
  */

/**
 * @typedef {Object} ZoneQuestion
 * @property {number | number[]} points
 * @property {number | []} maxPoints
 * @property {string} id
 * @property {boolean} forceMaxPoints
 * @property {QuestionAlternative[]} alternatives
 * @property {number} numberChoose
 * @property {number} triesPerVariant
 */

/**
 * @typedef {Object} Zone
 * @property {string} title
 * @property {number} maxPoints
 * @property {number} maxChoose
 * @property {number} bestQuestions
 * @property {ZoneQuestion[]} questions
 */

/**
 * @typedef {Object} Assessment
 * @property {string} uuid
 * @property {"Homework" | "Exam"} type
 * @property {string} title
 * @property {string} set
 * @property {string} number
 * @property {boolean} allowIssueReporting
 * @property {boolean} multipleInstance
 * @property {boolean} shuffleQuestions
 * @property {AssessmentAllowAccess[]} allowAccess
 * @property {string} text
 * @property {number} maxPoints
 * @property {boolean} autoClose
 * @property {Zone[]} zones
 * @property {boolean} constantQuestionValue
 */

/**
 * @typedef {Object} QuestionExternalGradingOptions
 * @property {boolean} enabled
 * @property {string} image
 * @property {string} entrypoint
 * @property {string[]} serverFilesCourse
 * @property {number} timeout
 * @property {boolean} enableNetworking
 */

 /**
  * @typedef {Object} Question
  * @property {string} uuid
  * @property {"Calculation" | "ShortAnswer" | "MultipleChoice" | "Checkbox" | "File" | "MultipleTrueFalse" | "v3"} type
  * @property {string} title
  * @property {string} topic
  * @property {string[]} secondaryTopics
  * @property {string[]} tags
  * @property {string[]} clientFiles
  * @property {string[]} clientTemplates
  * @property {string} template
  * @property {"Internal" | "External" | "Manual"} gradingMethod
  * @property {boolean} singleVariant
  * @property {boolean} partialCredit
  * @property {Object} options
  * @property {QuestionExternalGradingOptions} externalGradingOptions
  */

/**
 * @typedef {object} CourseInstanceData
 * @property {Either<CourseInstance>} courseInstance
 * @property {{ [tid: string]: Either<Assessment> }} assessments
 */

/**
 * @typedef {object} CourseData
 * @property {Either<Course>} course
 * @property {{ [qid: string]: Either<Question> }} questions
 * @property {{ [ciid: string]: CourseInstanceData }} courseInstances
 */

/**
 * @param {string} courseDir
 * @param {any} logger
 * @returns {Promise<CourseData>}
 */
module.exports.loadFullCourseNewAsync = async function(courseDir, logger) {
    const infoCoursePath = path.join(courseDir, 'infoCourse.json');
    const courseInfo = await this.loadCourseInfoNew(infoCoursePath);
    return {
        course: courseInfo,
        questions: {},
        courseInstances: {},
    }
}

/**
 * @param {string} infoCoursePath
 * @returns {Promise<Either<Course>>}
 */
module.exports.loadCourseInfoNew = async function(infoCoursePath) {
    return new Promise((resolve) => {
        /** @type Course */
        jsonLoad.readInfoJSON(infoCoursePath, schemas.infoCourse, function(err, info) {
            if (err) {
                resolve({ error: err.message });
                return;
            }

            const warnings = [];

            /** @type {AssessmentSet[]} */
            const assessmentSets = info.assessmentSets || [];
            DEFAULT_ASSESSMENT_SETS.forEach(aset => {
                if (assessmentSets.find(a => a.name === aset.name)) {
                    warnings.push(`Default assessmentSet "${aset.name}" should not be included in infoCourse.json`);
                } else {
                    assessmentSets.push(aset);
                }
            });

            /** @type {Tag[]} */
            const tags = info.tags || [];
            DEFAULT_TAGS.forEach(tag => {
                if (tags.find(t => t.name === tag.name)) {
                    warnings.push(`Default tag "${tag.name}" should not be included in infoCourse.json`);
                } else {
                    tags.push(tag);
                }
            });

            const isExampleCourse = info.uuid === 'fcc5282c-a752-4146-9bd6-ee19aac53fc5'
                && info.title === 'Example Course'
                && info.name === 'XC 101';

            /** @type {Course} */
            const course = {
                uuid: info.uuid.toLowerCase(),
                path: infoCoursePath,
                name: info.name,
                title: info.title,
                timezone: info.timezone,
                topics: info.topics,
                assessmentSets,
                tags,
                options: {
                    useNewQuestionRenderer: _.get(info, 'options.useNewQuestionRenderer', false),
                    isExampleCourse,
                },
            };

            resolve({
                data: course,
                warning: warnings.join('\n'),
            });
        });
    });
}