# sf-get-gcp-access-token

The Intent here is to provide a re-usable mechanism for API proxies to
obtain and cache a GCP access token. This works only for Apigee X and hybrid.

## Motivation

There's [a new
capability](https://cloud.google.com/apigee/docs/api-platform/security/google-auth/overview#deployment-steps)
available in Apigee X and hybrid that allows you to use Google Authentication within an API
Proxy, implicitly. It's really cool, super handy.

To use it, you can specify an Authentication element like the following into your ServiceCallout or TargetEndpoint:
```xml
  <GoogleAccessToken>
    <Scopes>
      <Scope>https://www.googleapis.com/auth/cloud-platform</Scope>
    </Scopes>
  </GoogleAccessToken>
```

And in that case, Apigee, at runtime, will generate the right token for you, using the service account you specified when you deploy the proxy.

But in some cases that won't work:

- you want to use a service account provisioned for a different GCP project
- you want to use multiple distinct service accounts for different endpoints or for different caller

In that case you may want to obtain tokens _explicitly_ in your API proxy flow.

This shared flow can help you do that.



## Using it

This is a parameterized Shared flow.  You can use it by embedding a FlowCallout policy into your API Proxy.
Provide the FlowCallout policy configuration to look something like this:

```xml
<FlowCallout name='FC-Get-GCP-Token'>
  <Parameters>
    <Parameter name='desired-token-scope'>https://www.googleapis.com/auth/spanner.data</Parameter>
    <Parameter name='token-cache-key'>argolis-spanner-token</Parameter>
    <Parameter name='kvm-map'>secrets</Parameter>
    <Parameter name='kvm-key-for-credentials-json'>argolis-spanner-credentials-json</Parameter>
  </Parameters>
  <SharedFlowBundle>sf-get-gcp-access-token</SharedFlowBundle>
</FlowCallout>
```


## Parameters

| Parameter name | comments     | examples     |
| -------------- | ------------ | ------------ |
| `desired-token-scope` | Optional. The scope claim to insert into the self-signed JWT. This will be the scope of the access token. Defaults to: `https://www.googleapis.com/auth/cloud-platform` | `https://www.googleapis.com/auth/spanner.data`<br/>`https://www.googleapis.com/auth/cloud-platform`<br/>`https://www.googleapis.com/auth/spreadsheets.readonly` |
| `token-cache-key` | Optional. The key to use in the cache for the GCP token. If multiple callers use the sharedflow, then each will want a distinct cache-key. Defaults to: `unnamed-token` | `argolis-spanner-token`, `default-sheets-token`, etc. |
| `kvm-map` | Optional. The name of the map that stores the credentials JSON. Defaults to: `secrets`. | anything |
| `kvm-key-for-credentials-json` | Optional. The name of the key in the KVM map that refers to the credentials JSON you inserted. Defaults to `sa-credentials-json`. | anything |


## Credentials

Before using this shared flow, you must load a Service Account credentials .json
file (the entire JSON payload) into the KVM under the KVM Key you want, in the
Environment-scoped Map you want.  Then embed a FlowCallout into the proxy to call this SF.

You need to take care to load the credentials json into the KVM correctly, so
that the JSON can be correctly parsed at runtime.

You can do this with the UI, or with [the shell script included here](./tools/xloadFileIntoKvm.sh).

```sh
TOKEN=$(gcloud auth print-access-token)
ORG=my-org
ENV=my-env
xloadFileIntoKvm.sh -t $TOKEN -o $ORG -e $ENV -F path.to/credentials-file.json -N entryname -M mapname
```


## How it works

The shared flow will look in cache for a token, with the given key. If found it
will return it. If not found, the SF will look in the environment-scoped KVM
map for a credentials JSON file, retrieve it, generate a signed JWT, post that
JWT to the googleapis oauth2 token endpoint, retrieve the response, parse it to
extract the bearer token, insert that into cache, then return it.

In either case, the output is a variable `gcp-access-token` which the caller can
embed as a bearer token into an Authorization header.

A few details:

- the token is cached for 3420 seconds. Google tokens are good for 1 hour, so
  this should be plenty.

- the KVM credentials are cached for 120s. This will probably matter only when
  initially setting up the Shared Flow.  The implication here: if you load
  something into the KVM, then test the Shared Flow, then find a problem (wrong
  credentials? Wrong formatting?) and try to load something else into the KVM,
  the KVM cache in the runtime will still hold the older (wrong?) value. to work
  around that problem: _You need to wait_ for the 120s to expire in order for
  the SF to see the newly loaded value in the KVM.

## Disclaimer

This is not an official Google product nor is it part of an official Google product.


## License

This material is [Copyright © 2022 Google LLC](./NOTICE).
and is licensed under the [Apache 2.0 License](LICENSE). This includes the Java
code as well as the API Proxy configuration.
