// Decompiled with JetBrains decompiler
// Type: PtsGonderme.NHLService.GenericService
// Assembly: PtsGonderme, Version=0.1.2.0, Culture=neutral, PublicKeyToken=null
// MVID: 872D54BB-AC65-4E3A-96DC-F5BC9D609A7E
// Assembly location: C:\Users\veyuc\OneDrive\Masaüstü\PtsGonderme.exe

using PtsGonderme.Properties;
using System;
using System.CodeDom.Compiler;
using System.ComponentModel;
using System.Diagnostics;
using System.Threading;
using System.Web.Services;
using System.Web.Services.Description;
using System.Web.Services.Protocols;
using System.Xml.Serialization;

#nullable disable
namespace PtsGonderme.NHLService
{
  [GeneratedCode("System.Web.Services", "4.8.4084.0")]
  [DebuggerStepThrough]
  [DesignerCategory("code")]
  [WebServiceBinding(Name = "GenericServiceSoap", Namespace = "http://tempuri.org/")]
  [XmlInclude(typeof (DBNull))]
  public class GenericService : SoapHttpClientProtocol
  {
    private SendOrPostCallback Test2OperationCompleted;
    private SendOrPostCallback PullDatasOperationCompleted;
    private SendOrPostCallback PullDatas_CompleteOperationCompleted;
    private SendOrPostCallback PushDatasetOperationCompleted;
    private SendOrPostCallback PushDatasOperationCompleted;
    private bool useDefaultCredentialsSetExplicitly;

    public GenericService()
    {
      this.Url = Settings.Default.PtsGonderme_NHLService_GenericService;
      if (this.IsLocalFileSystemWebService(this.Url))
      {
        this.UseDefaultCredentials = true;
        this.useDefaultCredentialsSetExplicitly = false;
      }
      else
        this.useDefaultCredentialsSetExplicitly = true;
    }

    public new string Url
    {
      get => base.Url;
      set
      {
        if (this.IsLocalFileSystemWebService(base.Url) && !this.useDefaultCredentialsSetExplicitly && !this.IsLocalFileSystemWebService(value))
          base.UseDefaultCredentials = false;
        base.Url = value;
      }
    }

    public new bool UseDefaultCredentials
    {
      get => base.UseDefaultCredentials;
      set
      {
        base.UseDefaultCredentials = value;
        this.useDefaultCredentialsSetExplicitly = true;
      }
    }

    public event Test2CompletedEventHandler Test2Completed;

    public event PullDatasCompletedEventHandler PullDatasCompleted;

    public event PullDatas_CompleteCompletedEventHandler PullDatas_CompleteCompleted;

    public event PushDatasetCompletedEventHandler PushDatasetCompleted;

    public event PushDatasCompletedEventHandler PushDatasCompleted;

    [SoapDocumentMethod("http://tempuri.org/Test2", RequestNamespace = "http://tempuri.org/", ResponseNamespace = "http://tempuri.org/", Use = SoapBindingUse.Literal, ParameterStyle = SoapParameterStyle.Wrapped)]
    public string Test2(string s)
    {
      return (string) this.Invoke(nameof (Test2), new object[1]
      {
        (object) s
      })[0];
    }

    public void Test2Async(string s) => this.Test2Async(s, (object) null);

    public void Test2Async(string s, object userState)
    {
      if (this.Test2OperationCompleted == null)
        this.Test2OperationCompleted = new SendOrPostCallback(this.OnTest2OperationCompleted);
      this.InvokeAsync("Test2", new object[1]{ (object) s }, this.Test2OperationCompleted, userState);
    }

    private void OnTest2OperationCompleted(object arg)
    {
      if (this.Test2Completed == null)
        return;
      InvokeCompletedEventArgs completedEventArgs = (InvokeCompletedEventArgs) arg;
      this.Test2Completed((object) this, new Test2CompletedEventArgs(completedEventArgs.Results, completedEventArgs.Error, completedEventArgs.Cancelled, completedEventArgs.UserState));
    }

    [SoapDocumentMethod("http://tempuri.org/PullDatas", RequestNamespace = "http://tempuri.org/", ResponseNamespace = "http://tempuri.org/", Use = SoapBindingUse.Literal, ParameterStyle = SoapParameterStyle.Wrapped)]
    public PullResult PullDatas(string TokenValue, PullParameters Datas)
    {
      return (PullResult) this.Invoke(nameof (PullDatas), new object[2]
      {
        (object) TokenValue,
        (object) Datas
      })[0];
    }

    public void PullDatasAsync(string TokenValue, PullParameters Datas)
    {
      this.PullDatasAsync(TokenValue, Datas, (object) null);
    }

    public void PullDatasAsync(string TokenValue, PullParameters Datas, object userState)
    {
      if (this.PullDatasOperationCompleted == null)
        this.PullDatasOperationCompleted = new SendOrPostCallback(this.OnPullDatasOperationCompleted);
      this.InvokeAsync("PullDatas", new object[2]
      {
        (object) TokenValue,
        (object) Datas
      }, this.PullDatasOperationCompleted, userState);
    }

    private void OnPullDatasOperationCompleted(object arg)
    {
      if (this.PullDatasCompleted == null)
        return;
      InvokeCompletedEventArgs completedEventArgs = (InvokeCompletedEventArgs) arg;
      this.PullDatasCompleted((object) this, new PullDatasCompletedEventArgs(completedEventArgs.Results, completedEventArgs.Error, completedEventArgs.Cancelled, completedEventArgs.UserState));
    }

    [SoapDocumentMethod("http://tempuri.org/PullDatas_Complete", RequestNamespace = "http://tempuri.org/", ResponseNamespace = "http://tempuri.org/", Use = SoapBindingUse.Literal, ParameterStyle = SoapParameterStyle.Wrapped)]
    public Pull_CompleteResult PullDatas_Complete(string TokenValue, Pull_CompleteParameters Datas)
    {
      return (Pull_CompleteResult) this.Invoke(nameof (PullDatas_Complete), new object[2]
      {
        (object) TokenValue,
        (object) Datas
      })[0];
    }

    public void PullDatas_CompleteAsync(string TokenValue, Pull_CompleteParameters Datas)
    {
      this.PullDatas_CompleteAsync(TokenValue, Datas, (object) null);
    }

    public void PullDatas_CompleteAsync(
      string TokenValue,
      Pull_CompleteParameters Datas,
      object userState)
    {
      if (this.PullDatas_CompleteOperationCompleted == null)
        this.PullDatas_CompleteOperationCompleted = new SendOrPostCallback(this.OnPullDatas_CompleteOperationCompleted);
      this.InvokeAsync("PullDatas_Complete", new object[2]
      {
        (object) TokenValue,
        (object) Datas
      }, this.PullDatas_CompleteOperationCompleted, userState);
    }

    private void OnPullDatas_CompleteOperationCompleted(object arg)
    {
      if (this.PullDatas_CompleteCompleted == null)
        return;
      InvokeCompletedEventArgs completedEventArgs = (InvokeCompletedEventArgs) arg;
      this.PullDatas_CompleteCompleted((object) this, new PullDatas_CompleteCompletedEventArgs(completedEventArgs.Results, completedEventArgs.Error, completedEventArgs.Cancelled, completedEventArgs.UserState));
    }

    [SoapDocumentMethod("http://tempuri.org/PushDataset", RequestNamespace = "http://tempuri.org/", ResponseNamespace = "http://tempuri.org/", Use = SoapBindingUse.Literal, ParameterStyle = SoapParameterStyle.Wrapped)]
    public PushDataSetResult PushDataset(string TokenValue, PushDataSetParameters Datas)
    {
      return (PushDataSetResult) this.Invoke(nameof (PushDataset), new object[2]
      {
        (object) TokenValue,
        (object) Datas
      })[0];
    }

    public void PushDatasetAsync(string TokenValue, PushDataSetParameters Datas)
    {
      this.PushDatasetAsync(TokenValue, Datas, (object) null);
    }

    public void PushDatasetAsync(string TokenValue, PushDataSetParameters Datas, object userState)
    {
      if (this.PushDatasetOperationCompleted == null)
        this.PushDatasetOperationCompleted = new SendOrPostCallback(this.OnPushDatasetOperationCompleted);
      this.InvokeAsync("PushDataset", new object[2]
      {
        (object) TokenValue,
        (object) Datas
      }, this.PushDatasetOperationCompleted, userState);
    }

    private void OnPushDatasetOperationCompleted(object arg)
    {
      if (this.PushDatasetCompleted == null)
        return;
      InvokeCompletedEventArgs completedEventArgs = (InvokeCompletedEventArgs) arg;
      this.PushDatasetCompleted((object) this, new PushDatasetCompletedEventArgs(completedEventArgs.Results, completedEventArgs.Error, completedEventArgs.Cancelled, completedEventArgs.UserState));
    }

    [SoapDocumentMethod("http://tempuri.org/PushDatas", RequestNamespace = "http://tempuri.org/", ResponseNamespace = "http://tempuri.org/", Use = SoapBindingUse.Literal, ParameterStyle = SoapParameterStyle.Wrapped)]
    public PushResult PushDatas(string TokenValue, PushParameters Datas)
    {
      return (PushResult) this.Invoke(nameof (PushDatas), new object[2]
      {
        (object) TokenValue,
        (object) Datas
      })[0];
    }

    public void PushDatasAsync(string TokenValue, PushParameters Datas)
    {
      this.PushDatasAsync(TokenValue, Datas, (object) null);
    }

    public void PushDatasAsync(string TokenValue, PushParameters Datas, object userState)
    {
      if (this.PushDatasOperationCompleted == null)
        this.PushDatasOperationCompleted = new SendOrPostCallback(this.OnPushDatasOperationCompleted);
      this.InvokeAsync("PushDatas", new object[2]
      {
        (object) TokenValue,
        (object) Datas
      }, this.PushDatasOperationCompleted, userState);
    }

    private void OnPushDatasOperationCompleted(object arg)
    {
      if (this.PushDatasCompleted == null)
        return;
      InvokeCompletedEventArgs completedEventArgs = (InvokeCompletedEventArgs) arg;
      this.PushDatasCompleted((object) this, new PushDatasCompletedEventArgs(completedEventArgs.Results, completedEventArgs.Error, completedEventArgs.Cancelled, completedEventArgs.UserState));
    }

    public new void CancelAsync(object userState) => base.CancelAsync(userState);

    private bool IsLocalFileSystemWebService(string url)
    {
      if (url == null || url == string.Empty)
        return false;
      Uri uri = new Uri(url);
      return uri.Port >= 1024 && string.Compare(uri.Host, "localHost", StringComparison.OrdinalIgnoreCase) == 0;
    }
  }
}
