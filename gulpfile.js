var gulp = require('gulp');
var concat = require('gulp-concat');
var closureCompiler = require('google-closure-compiler').gulp();
var rename = require('gulp-rename');
var replace = require('gulp-replace');

var testFiles = [
    'src/r7insight.js',
    'test/sinon*.js',
    'test/*Spec.js'
];
var apiVersion = 1;
var apiEndpoint = 'js.logs.insight.rapid7.com/v' + apiVersion;
var webhookEndpoint = 'webhook.logs.insight.rapid7.com/noformat';


gulp.task('default', ['test', 'build']);


gulp.task('watch', function() {
    gulp.watch('src/r7insight.js', ['test']);
});


gulp.task('build', function() {
    return gulp.src('src/r7insight.js')
        .pipe(concat('r7insight.js')) // We've only got one file but still need this
        .pipe(replace(/localhost:8080\/v1/g, apiEndpoint))
        .pipe(replace(/localhost:8080\/noformat/g, webhookEndpoint))
        .pipe(gulp.dest('product'))
        .pipe(closureCompiler({
            compilation_level: 'SIMPLE_OPTIMIZATIONS',
            warning_level: 'VERBOSE',
            debug: false,
            language_in: 'ECMASCRIPT5_STRICT',
            externs: 'deps/umd-extern.js'
        }))
        .pipe(rename('r7insight.min.js'))
        .pipe(gulp.dest('product'));
});
