// import nock from 'nock';
// nock('https://cdn.door43.org:443', {'encodedQueryParams': true})
// .get('/hi/irv/v1/tit.zip')
// .reply(200, 'some data', ['Content-Type',
// 'application/zip',
// 'Content-Length',
// '18170',
// 'Connection',
// 'keep-alive',
// 'Date',
// 'Wed, 10 Jul 2019 17:41:01 GMT',
// 'Last-Modified',
// 'Wed, 19 Sep 2018 12:18:34 GMT',
// 'ETag',
// '"c27f0f02ce5e3d741d9066437c333ce7"',
// 'Cache-Control',
// 'max-age=600',
// 'x-amz-version-id',
// 'null',
// 'Accept-Ranges',
// 'bytes',
// 'Server',
// 'AmazonS3',
// 'Age',
// '238',
// 'X-Cache',
// 'Hit from cloudfront',
// 'Via',
// '1.1 daae44b5ed5fd346ffd4c678f209878f.cloudfront.net (CloudFront)',
// 'X-Amz-Cf-Pop',
// 'LAX3-C2',
// 'X-Amz-Cf-Id',
// '7zStlxLnQnaogQdaQty72Z_qsAiXe0Ho4TBpaUkIF8y03XEJp_UmFw==']);
//
// nock('https://retry.org:443', {'encodedQueryParams': true})
// .get('/1')
// .replyWithError({
//   message: 'There was a socket timeout',
//   code: 'ERR_SOCKET_TIMEOUT',
// });
//
// nock('https://retry.org:443', {'encodedQueryParams': true})
// .get('/1')
// .reply(200, 'some data', ['Content-Type',
// 'application/zip',
// 'Content-Length',
// '18170',
// 'Connection',
// 'keep-alive',
// 'Date',
// 'Wed, 10 Jul 2019 17:41:01 GMT',
// 'Last-Modified',
// 'Wed, 19 Sep 2018 12:18:34 GMT',
// 'ETag',
// '"c27f0f02ce5e3d741d9066437c333ce7"',
// 'Cache-Control',
// 'max-age=600',
// 'x-amz-version-id',
// 'null',
// 'Accept-Ranges',
// 'bytes',
// 'Server',
// 'AmazonS3',
// 'Age',
// '238',
// 'X-Cache',
// 'Hit from cloudfront',
// 'Via',
// '1.1 daae44b5ed5fd346ffd4c678f209878f.cloudfront.net (CloudFront)',
// 'X-Amz-Cf-Pop',
// 'LAX3-C2',
// 'X-Amz-Cf-Id',
// '7zStlxLnQnaogQdaQty72Z_qsAiXe0Ho4TBpaUkIF8y03XEJp_UmFw==']);
//
//
// nock('https://retry.org:443', {'encodedQueryParams': true})
// .get('/2')
// .replyWithError({
//   message: 'There was a socket timeout',
//   code: 'ERR_SOCKET_TIMEOUT',
// });
//
// nock('https://retry.org:443', {'encodedQueryParams': true})
// .get('/2')
// .replyWithError({
//   message: 'There was a socket timeout',
//   code: 'ERR_SOCKET_TIMEOUT',
// });
//
//
// nock('https://retry.org:443', {'encodedQueryParams': true})
// .get('/2')
// .reply(200, 'some data', ['Content-Type',
// 'application/zip',
// 'Content-Length',
// '18170',
// 'Connection',
// 'keep-alive',
// 'Date',
// 'Wed, 10 Jul 2019 17:41:01 GMT',
// 'Last-Modified',
// 'Wed, 19 Sep 2018 12:18:34 GMT',
// 'ETag',
// '"c27f0f02ce5e3d741d9066437c333ce7"',
// 'Cache-Control',
// 'max-age=600',
// 'x-amz-version-id',
// 'null',
// 'Accept-Ranges',
// 'bytes',
// 'Server',
// 'AmazonS3',
// 'Age',
// '238',
// 'X-Cache',
// 'Hit from cloudfront',
// 'Via',
// '1.1 daae44b5ed5fd346ffd4c678f209878f.cloudfront.net (CloudFront)',
// 'X-Amz-Cf-Pop',
// 'LAX3-C2',
// 'X-Amz-Cf-Id',
// '7zStlxLnQnaogQdaQty72Z_qsAiXe0Ho4TBpaUkIF8y03XEJp_UmFw==']);
//
//
// nock('https://retry.org:443', {'encodedQueryParams': true})
// .get('/4')
// .replyWithError({
//   message: 'There was a socket timeout',
//   code: 'ERR_SOCKET_TIMEOUT',
// });
//
// nock('https://retry.org:443', {'encodedQueryParams': true})
// .get('/4')
// .replyWithError({
//   message: 'There was a socket timeout',
//   code: 'ERR_SOCKET_TIMEOUT',
// });
//
// nock('https://retry.org:443', {'encodedQueryParams': true})
// .get('/4')
// .replyWithError({
//   message: 'There was a socket timeout',
//   code: 'ERR_SOCKET_TIMEOUT',
// });
//
// nock('https://retry.org:443', {'encodedQueryParams': true})
// .get('/4')
// .replyWithError({
//   message: 'There was a socket timeout',
//   code: 'ERR_SOCKET_TIMEOUT',
// });
