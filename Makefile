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

