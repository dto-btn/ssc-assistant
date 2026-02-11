# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container
COPY example-server/requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the common security logic and the example server code
# Note: This assumes the build context is the 'mcp-servers' directory
COPY common/ /app/common/
COPY example-server/ /app/example-server/

# Set working directory to the example server
WORKDIR /app/example-server

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Run main.py when the container launches
CMD ["python", "main.py"]
