.PHONY: push

CURRENT_BRANCH_NAME := $(shell git symbolic-ref --short HEAD)
VERSION_TEST_PATH := "./test/singleFunc/baseVersion/"
SERVICE_NAME_TEST_PATH := "./test/singleFunc/serviceName/"
GRAYSCALE_PARAMS_TEST_PATH := "./test/singleFunc/grayscale/"
add:
	git add .

commit: add
	git-cz

rebase-main: commit
	git pull --rebase origin main

push:
	git push --force-with-lease origin $(CURRENT_BRANCH_NAME)

release-dev: push
	-gh release delete dev -y
	-git tag -d dev
	-git push origin :refs/tags/dev
	gh release create dev --notes "dev release" --target master --title "Release dev" --prerelease

roll-back-dev:
	git reset --soft HEAD~1
	git restore --staged publish.yaml
	git restore publish.yaml

test-version:
	s deploy -t ${VERSION_TEST_PATH}s-baseVersion-illegal.yaml --use-local > ${VERSION_TEST_PATH}test.out
	s deploy -t ${VERSION_TEST_PATH}s-baseVersion-not-exist.yaml --use-local >> ${VERSION_TEST_PATH}test.out
	s deploy -t ${VERSION_TEST_PATH}s-baseVersion-undefined.yaml --use-local >> ${VERSION_TEST_PATH}test.out
	s deploy -t ${VERSION_TEST_PATH}s-baseVersion-success.yaml --use-local >> ${VERSION_TEST_PATH}test.out

test-service-name:
	s deploy -t ${SERVICE_NAME_TEST_PATH}s-serviceName-not-exist.yaml --use-local > ${SERVICE_NAME_TEST_PATH}test.out
	s deploy -t ${SERVICE_NAME_TEST_PATH}s-serviceName-success.yaml --use-local >> ${SERVICE_NAME_TEST_PATH}test.out
	s deploy -t ${SERVICE_NAME_TEST_PATH}s-serviceName-undefined.yaml --use-local >> ${SERVICE_NAME_TEST_PATH}test.out

test-grayscale-params:
	s deploy -t ${GRAYSCALE_PARAMS_TEST_PATH}s-canaryPlan-interval-miss.yaml --use-local > ${GRAYSCALE_PARAMS_TEST_PATH}test.out
	s deploy -t ${GRAYSCALE_PARAMS_TEST_PATH}s-canaryPlan-no-plan.yaml --use-local >> ${GRAYSCALE_PARAMS_TEST_PATH}test.out
	s deploy -t ${GRAYSCALE_PARAMS_TEST_PATH}s-canaryPlan-weight-illegal.yaml --use-local >> ${GRAYSCALE_PARAMS_TEST_PATH}test.out
	s deploy -t ${GRAYSCALE_PARAMS_TEST_PATH}s-canaryPlan-weight-miss.yaml --use-local >> ${GRAYSCALE_PARAMS_TEST_PATH}test.out
	s deploy -t ${GRAYSCALE_PARAMS_TEST_PATH}s-canaryStep-interval-undefined.yaml --use-local >> ${GRAYSCALE_PARAMS_TEST_PATH}test.out
	s deploy -t ${GRAYSCALE_PARAMS_TEST_PATH}s-canaryStep-weight-miss.yaml --use-local >> ${GRAYSCALE_PARAMS_TEST_PATH}test.out
	s deploy -t ${GRAYSCALE_PARAMS_TEST_PATH}s-canaryStep-weight-illegal.yaml--use-local >> ${GRAYSCALE_PARAMS_TEST_PATH}test.out
	s deploy -t ${GRAYSCALE_PARAMS_TEST_PATH}s-lineStep-interval-undefined.yaml --use-local >> ${GRAYSCALE_PARAMS_TEST_PATH}test.out
	s deploy -t ${GRAYSCALE_PARAMS_TEST_PATH}s-lineStep-weight-illegal.yaml --use-local >> ${GRAYSCALE_PARAMS_TEST_PATH}test.out
	s deploy -t ${GRAYSCALE_PARAMS_TEST_PATH}s-lineStep-weight-miss.yaml --use-local >> ${GRAYSCALE_PARAMS_TEST_PATH}test.out
	s deploy -t ${GRAYSCALE_PARAMS_TEST_PATH}s-2-grayscale-strategies.yaml --use-local >> ${GRAYSCALE_PARAMS_TEST_PATH}test.out
	s deploy -t ${GRAYSCALE_PARAMS_TEST_PATH}s-canaryweight-weight-illegal.yaml --use-local >> ${GRAYSCALE_PARAMS_TEST_PATH}test.out


