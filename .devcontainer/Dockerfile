# https://hub.docker.com/r/microsoft/devcontainers
FROM mcr.microsoft.com/devcontainers/python:3.11

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
RUN bash nodesource_setup.sh
RUN apt-get install -y nodejs
RUN node -v

WORKDIR /workspace

EXPOSE 5001 8000