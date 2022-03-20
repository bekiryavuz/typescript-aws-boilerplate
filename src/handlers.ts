import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import AWS from "aws-sdk";
import { v4 } from "uuid";
import * as yup from "yup";

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = "Assets";
const headers = {
  "content-type": "application/json",
};

const schema = yup.object().shape({
  name: yup.string().required(),
  serialNo: yup.string().required(),
  assignDate: yup.date().required(),
});

class HttpError extends Error {
  constructor(public statusCode: number, body: Record<string, unknown>) {
    super(JSON.stringify(body));
  }
}

const fetchAssetById = async (id: string) => {
  const output = await docClient
    .get({
      TableName: tableName,
      Key: {
        assetId: id,
      },
    })
    .promise();

  if (!output.Item) {
    throw new HttpError(404, { error: "not found" });
  }
  return output.Item;
};

const handleError = (e: unknown) => {
  if (e instanceof yup.ValidationError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        errors: e.errors,
      }),
    };
  }

  if (e instanceof SyntaxError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `invalid request body format: "${e.message}"` }),
    };
  }

  if (e instanceof HttpError) {
    return {
      statusCode: e.statusCode,
      headers,
      body: e.message,
    };
  }
  throw e;
};

export const createAsset = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const reqBody = JSON.parse(event.body as string);

    await schema.validate(reqBody, { abortEarly: false });

    const asset = {
      ...reqBody,
      assetId: v4(),
    };
    await docClient
      .put({
        TableName: tableName,
        Item: asset,
      })
      .promise();
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(asset),
    };
  } catch (e) {
    return handleError(e);
  }
};

export const listAsset = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const output = await docClient
      .scan({
        TableName: tableName,
      })
      .promise();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(output.Items),
    };
  } catch (e) {
    return handleError(e);
  }
};

export const deleteAsset = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id as string;
    await fetchAssetById(id);
    await docClient
      .delete({
        TableName: tableName,
        Key: {
          assetId: id,
        },
      })
      .promise();
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ process: `${id}   Successfully deleted...` }),
    };
  } catch (e) {
    return handleError(e);
  }
};

export const updateAsset = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id as string;

    await fetchAssetById(id);

    const reqBody = JSON.parse(event.body as string);

    await schema.validate(reqBody, { abortEarly: false });

    const asset = {
      ...reqBody,
      assetId: id,
    };
    await docClient
      .put({
        TableName: tableName,
        Item: asset,
      })
      .promise();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(asset),
    };
  } catch (e) {
    return handleError(e);
  }
};

export const getAsset = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const asset = await fetchAssetById(event.pathParameters?.id as string);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(asset),
    };
  } catch (e) {
    return handleError(e);
  }
};
