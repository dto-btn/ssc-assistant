# https://hub.docker.com/r/microsoft/devcontainers
FROM mcr.microsoft.com/devcontainers/python:3.11

# Install Node.js
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs

WORKDIR /workspace

# Install python dependencies
COPY app/api/requirements.txt /tmp/pip-tmp/
RUN pip install --no-cache-dir -r /tmp/pip-tmp/requirements.txt \
    && rm -rf /tmp/pip-tmp

# Install frontend dependencies
COPY app/frontend/package.json /tmp/npm-tmp/
RUN cd /tmp/npm-tmp && npm install \
    && rm -rf /tmp/npm-tmp

EXPOSE 5001 8000